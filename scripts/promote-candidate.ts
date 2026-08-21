import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}

const sql = neon(url);

const DIFFICULTIES = ["easy", "medium", "challenging"] as const;
const ERAS = ["ancient", "19th_century", "early_20th_century", "modern"] as const;
const RIGHTS_STATUSES = ["public_domain", "licensed", "unverified"] as const;

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) {
      flags[arg.slice(2)] = "true"; // boolean flags like --force-pd
    } else {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    }
  }
  return flags;
}

async function listPending() {
  const rows = await sql`
    select id, title, author_name, category, source_name, created_at
    from content_candidates
    where status = 'needs_review'
    order by created_at asc
  `;

  if (rows.length === 0) {
    console.log("No candidates awaiting review.");
    return;
  }

  console.log(`${rows.length} candidate(s) awaiting review:\n`);
  for (const r of rows) {
    console.log(`  ${r.id}  [${r.category}]  ${r.title} — ${r.author_name}  (${r.source_name})`);
  }
}

async function show(id: string) {
  const rows = await sql`select * from content_candidates where id = ${id}`;
  const c = rows[0];
  if (!c) {
    console.error(`No candidate found with id ${id}`);
    process.exit(1);
  }

  console.log(`Title:        ${c.title as string}`);
  console.log(`Author:       ${c.author_name as string}`);
  console.log(`Year:         ${c.year ?? "(unset)"}`);
  console.log(`Category:     ${c.category as string}`);
  console.log(`Source:       ${c.source_name as string} — ${c.source_url as string}`);
  console.log(`Region:       ${c.region ?? "(unset)"}`);
  console.log(`Tags:         ${((c.tags as string[]) ?? []).join(", ") || "(none)"}`);
  console.log(`Reading time: ${c.reading_minutes ?? "(unset)"} min`);
  console.log(`Description:  ${c.description ?? "(unset — required before promoting)"}`);
  console.log(`Rights:       ${c.rights_status as string} (source tier: ${c.source_tier as string})`);
  console.log(`Origin:       ${c.origin as string}`);
  console.log(`\n--- text_content ---\n`);
  console.log(c.text_content ?? "(unset — required before promoting)");
}

/**
 * Fills description/tags/era/difficulty/region/rights_status/reading_minutes
 * on a staged candidate without hand-editing SQL — the real friction the old
 * flow had, since fetch-candidates.ts never sets description/tags itself.
 */
async function edit(id: string, flags: Record<string, string>) {
  const rows = await sql`select * from content_candidates where id = ${id}`;
  const candidate = rows[0];
  if (!candidate) {
    console.error(`No candidate found with id ${id}`);
    process.exit(1);
  }

  if (flags.era && !ERAS.includes(flags.era as (typeof ERAS)[number])) {
    console.error(`--era must be one of: ${ERAS.join(", ")}`);
    process.exit(1);
  }
  if (
    flags["rights-status"] &&
    !RIGHTS_STATUSES.includes(flags["rights-status"] as (typeof RIGHTS_STATUSES)[number])
  ) {
    console.error(`--rights-status must be one of: ${RIGHTS_STATUSES.join(", ")}`);
    process.exit(1);
  }

  const description = flags.description ?? (candidate.description as string | null);
  const tags = flags.tags ? flags.tags.split(",").map((t) => t.trim()) : (candidate.tags as string[]);
  const region = flags.region ?? (candidate.region as string | null);
  const readingMinutes = flags["reading-minutes"]
    ? Number(flags["reading-minutes"])
    : (candidate.reading_minutes as number | null);
  const rightsStatus = flags["rights-status"] ?? (candidate.rights_status as string);

  await sql`
    update content_candidates
    set description = ${description}, tags = ${tags}, region = ${region},
        reading_minutes = ${readingMinutes}, rights_status = ${rightsStatus}
    where id = ${id}
  `;

  console.log(`Updated candidate ${id}. Run \`npm run review -- show ${id}\` to review.`);
}

async function promote(id: string, flags: Record<string, string>) {
  const rows = await sql`select * from content_candidates where id = ${id}`;
  const candidate = rows[0];

  if (!candidate) {
    console.error(`No candidate found with id ${id}`);
    process.exit(1);
  }
  if (candidate.promoted_work_id) {
    console.error(`Candidate already promoted as work ${candidate.promoted_work_id}`);
    process.exit(1);
  }
  if (!candidate.text_content || !candidate.description || !candidate.reading_minutes) {
    console.error(
      "Candidate is missing text_content, description, or reading_minutes. Run `npm run review -- edit " +
        id +
        " --description=... --tags=a,b,c` to fill the gaps."
    );
    process.exit(1);
  }
  if (flags.difficulty && !DIFFICULTIES.includes(flags.difficulty as (typeof DIFFICULTIES)[number])) {
    console.error(`--difficulty must be one of: ${DIFFICULTIES.join(", ")}`);
    process.exit(1);
  }
  if (!flags.era) {
    console.error(`--era is required: one of ${ERAS.join(", ")}`);
    process.exit(1);
  }
  if (!ERAS.includes(flags.era as (typeof ERAS)[number])) {
    console.error(`--era must be one of: ${ERAS.join(", ")}`);
    process.exit(1);
  }

  const rightsStatus = candidate.rights_status as string;
  if (rightsStatus !== "public_domain" && !flags["force-pd"]) {
    console.error(
      `Candidate's rights_status is "${rightsStatus}", not "public_domain" — promoting would silently ` +
        `mark it public domain otherwise. Either fix the status first (\`npm run review -- edit ${id} ` +
        `--rights-status=public_domain\`, if you've actually verified it), or pass --force-pd to promote ` +
        `as-is and make that call explicitly.`
    );
    process.exit(1);
  }

  const difficulty = flags.difficulty ?? "medium";
  const era = flags.era;

  const authorRows = await sql`
    insert into authors (name)
    values (${candidate.author_name as string})
    on conflict (name) do update set name = excluded.name
    returning id
  `;
  const authorId = authorRows[0].id;

  const workRows = await sql`
    insert into works (
      title, author_id, year, category, text_content, description,
      source_name, source_url, rights_status, difficulty, reading_minutes,
      era, region, status, origin
    ) values (
      ${candidate.title as string}, ${authorId}, ${candidate.year as number | null},
      ${candidate.category as string}, ${candidate.text_content as string},
      ${candidate.description as string}, ${candidate.source_name as string},
      ${candidate.source_url as string}, ${rightsStatus}, ${difficulty},
      ${candidate.reading_minutes as number}, ${era}, ${candidate.region as string | null},
      'approved', ${candidate.origin as string}
    )
    on conflict (title, author_id) do update set status = 'approved', updated_at = now()
    returning id
  `;
  const workId = workRows[0].id;

  const tags = (candidate.tags as string[] | null) ?? [];
  for (const tagSlug of tags) {
    const tagRows = await sql`
      insert into tags (slug)
      values (${tagSlug})
      on conflict (slug) do update set slug = excluded.slug
      returning id
    `;
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

  console.log(`Promoted "${candidate.title as string}" → work ${workId} (rights: ${rightsStatus})`);
}

async function reject(id: string, notes: string | undefined) {
  await sql`
    update content_candidates
    set status = 'rejected', reviewer_notes = ${notes ?? null}, reviewed_at = now()
    where id = ${id}
  `;
  console.log(`Rejected candidate ${id}`);
}

async function main() {
  const [cmd, arg, ...rest] = process.argv.slice(2);

  if (!cmd || cmd === "list") {
    await listPending();
    return;
  }
  if (cmd === "show" && arg) {
    await show(arg);
    return;
  }
  if (cmd === "edit" && arg) {
    await edit(arg, parseFlags(rest));
    return;
  }
  if (cmd === "promote" && arg) {
    await promote(arg, parseFlags(rest));
    return;
  }
  if (cmd === "reject" && arg) {
    await reject(arg, rest.filter((a) => !a.startsWith("--")).join(" ") || undefined);
    return;
  }

  console.log("Usage:");
  console.log("  npm run review                              # list candidates awaiting review");
  console.log("  npm run review -- show <candidate-id>        # print full details + text");
  console.log(
    "  npm run review -- edit <candidate-id> [--description=\"...\"] [--tags=a,b,c] [--region=...] [--reading-minutes=N] [--rights-status=public_domain|licensed|unverified]"
  );
  console.log(
    "  npm run review -- promote <candidate-id> --era=ancient|19th_century|early_20th_century|modern [--difficulty=easy|medium|challenging] [--force-pd]"
  );
  console.log("  npm run review -- reject <candidate-id> [notes]");
  process.exitCode = 1;
}

main();
