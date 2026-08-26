import { getDb } from "@/lib/db";

/**
 * The actual review/promote/reject logic, shared by scripts/promote-
 * candidate.ts (the CLI a human or the scheduled agent runs) and
 * app/admin/review (the web UI for signed-in reviewers) — one set of
 * rules, not two copies that could quietly drift apart. Every caller goes
 * through the exact same validation regardless of which surface it came
 * from.
 */

export const DIFFICULTIES = ["easy", "medium", "challenging"] as const;
export const ERAS = ["ancient", "19th_century", "early_20th_century", "modern"] as const;
export const RIGHTS_STATUSES = ["public_domain", "licensed", "unverified"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];
export type Era = (typeof ERAS)[number];
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export type Candidate = {
  id: string;
  title: string;
  author_name: string;
  year: number | null;
  category: "poem" | "essay" | "story";
  text_content: string | null;
  description: string | null;
  source_name: string;
  source_url: string | null;
  region: string | null;
  tags: string[];
  reading_minutes: number | null;
  origin: string;
  status: string;
  rights_status: RightsStatus;
  source_tier: string;
  reviewer_notes: string | null;
  promoted_work_id: string | null;
  created_at: string;
};

export async function listPendingCandidates(): Promise<Candidate[]> {
  const sql = getDb();
  const rows = await sql`
    select * from content_candidates where status = 'needs_review' order by created_at asc
  `;
  return rows as unknown as Candidate[];
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  const sql = getDb();
  const rows = (await sql`select * from content_candidates where id = ${id}`) as unknown as Candidate[];
  return rows[0] ?? null;
}

export async function editCandidate(
  id: string,
  fields: {
    description?: string;
    tags?: string[];
    region?: string;
    readingMinutes?: number;
    rightsStatus?: RightsStatus;
    sourceUrl?: string;
  }
): Promise<{ error: string } | { ok: true }> {
  const candidate = await getCandidate(id);
  if (!candidate) return { error: `No candidate found with id ${id}` };

  if (fields.rightsStatus && !RIGHTS_STATUSES.includes(fields.rightsStatus)) {
    return { error: `rights-status must be one of: ${RIGHTS_STATUSES.join(", ")}` };
  }

  const description = fields.description ?? candidate.description;
  const tags = fields.tags ?? candidate.tags;
  const region = fields.region ?? candidate.region;
  const readingMinutes = fields.readingMinutes ?? candidate.reading_minutes;
  const rightsStatus = fields.rightsStatus ?? candidate.rights_status;
  const sourceUrl = fields.sourceUrl ?? candidate.source_url;

  const sql = getDb();
  await sql`
    update content_candidates
    set description = ${description}, tags = ${tags}, region = ${region},
        reading_minutes = ${readingMinutes}, rights_status = ${rightsStatus},
        source_url = ${sourceUrl}
    where id = ${id}
  `;
  return { ok: true };
}

export async function promoteCandidate(
  id: string,
  options: { era?: Era; difficulty?: Difficulty; forcePd?: boolean } = {}
): Promise<{ error: string } | { ok: true; workId: string }> {
  const candidate = await getCandidate(id);
  if (!candidate) return { error: `No candidate found with id ${id}` };
  if (candidate.promoted_work_id) {
    return { error: `Candidate already promoted as work ${candidate.promoted_work_id}` };
  }
  if (!candidate.text_content || !candidate.description || !candidate.reading_minutes) {
    return {
      error:
        "Candidate is missing text_content, description, or reading_minutes — edit it first.",
    };
  }
  if (!candidate.source_url) {
    return { error: "Candidate has no source_url — a promoted work always needs one to cite." };
  }
  if (options.era && !ERAS.includes(options.era)) {
    return { error: `era must be one of: ${ERAS.join(", ")}` };
  }
  if (options.difficulty && !DIFFICULTIES.includes(options.difficulty)) {
    return { error: `difficulty must be one of: ${DIFFICULTIES.join(", ")}` };
  }

  const rightsStatus = candidate.rights_status;
  if (rightsStatus !== "public_domain" && !options.forcePd) {
    return {
      error:
        `Candidate's rights_status is "${rightsStatus}", not "public_domain" — promoting would ` +
        `silently mark it public domain otherwise. Either fix the status first, if you've actually ` +
        `verified it, or pass forcePd to promote as-is and make that call explicitly.`,
    };
  }

  const difficulty = options.difficulty ?? "medium";
  const sql = getDb();

  const authorRows = (await sql`
    insert into authors (name)
    values (${candidate.author_name})
    on conflict (name) do update set name = excluded.name
    returning id
  `) as unknown as { id: string }[];
  const authorId = authorRows[0].id;

  const workRows = (await sql`
    insert into works (
      title, author_id, year, category, text_content, description,
      source_name, source_url, rights_status, difficulty, reading_minutes,
      era, region, status, origin
    ) values (
      ${candidate.title}, ${authorId}, ${candidate.year},
      ${candidate.category}, ${candidate.text_content},
      ${candidate.description}, ${candidate.source_name},
      ${candidate.source_url}, ${rightsStatus}, ${difficulty},
      ${candidate.reading_minutes}, ${options.era ?? null}, ${candidate.region},
      'approved', ${candidate.origin}
    )
    on conflict (title, author_id) do update set status = 'approved', updated_at = now()
    returning id
  `) as unknown as { id: string }[];
  const workId = workRows[0].id;

  for (const tagSlug of candidate.tags ?? []) {
    const tagRows = (await sql`
      insert into tags (slug)
      values (${tagSlug})
      on conflict (slug) do update set slug = excluded.slug
      returning id
    `) as unknown as { id: string }[];
    await sql`
      insert into work_tags (work_id, tag_id)
      values (${workId}, ${tagRows[0].id})
      on conflict do nothing
    `;
  }

  await sql`
    update content_candidates
    set status = 'approved', promoted_work_id = ${workId}, reviewed_at = now()
    where id = ${id}
  `;

  return { ok: true, workId };
}

export async function rejectCandidate(id: string, notes?: string): Promise<{ ok: true }> {
  const sql = getDb();
  await sql`
    update content_candidates
    set status = 'rejected', reviewer_notes = ${notes ?? null}, reviewed_at = now()
    where id = ${id}
  `;
  return { ok: true };
}
