import { readFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { computeRightsStatus, type RightsStatus } from "@/lib/rights";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}

const sql = neon(url);

type SourceTier = "high_trust" | "standard" | "ocr_unverified";

type CandidateInput = {
  title: string;
  author_name: string;
  year: number;
  category: "poem" | "essay" | "story";
  text_content: string;
  description: string;
  source_name: string;
  source_url: string;
  region?: string;
  tags: string[];
  reading_minutes: number;
  rights_status?: RightsStatus; // computed from `year` if omitted
  source_tier?: SourceTier; // defaults to 'standard' (Gutenberg/Wikisource) if omitted
};

function sourceTierFor(sourceUrl: string): SourceTier {
  try {
    const { hostname } = new URL(sourceUrl);
    if (hostname.endsWith("standardebooks.org")) return "high_trust";
    if (hostname.endsWith("gutenberg.org") || hostname.endsWith("wikisource.org")) return "standard";
    return "ocr_unverified";
  } catch {
    return "standard";
  }
}

/**
 * Same intent as fetch-candidates.ts's near-duplicate check — this path was
 * the one place a batch could re-stage a title already promoted into
 * `works`, since the old check only looked at content_candidates.source_url.
 */
async function findNearDuplicate(title: string): Promise<string | null> {
  const rows = await sql`
    select title, 'candidate' as where_found from content_candidates
    where similarity(title, ${title}) > 0.6
    union all
    select title, 'work' as where_found from works
    where similarity(title, ${title}) > 0.6
    limit 1
  `;
  if (rows.length === 0) return null;
  return `"${rows[0].title as string}" already in ${rows[0].where_found as string}`;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npm run load-candidates -- <path-to-json>");
    process.exit(1);
  }

  const filePath = path.resolve(file);
  const candidates: CandidateInput[] = JSON.parse(readFileSync(filePath, "utf-8"));

  console.log(`Loading ${candidates.length} candidates from ${filePath}…`);

  for (const c of candidates) {
    try {
      const existing = await sql`
        select 1 from content_candidates where source_url = ${c.source_url} limit 1
      `;
      if (existing.length > 0) {
        console.log(`  – skipped (already staged) — ${c.title}`);
        continue;
      }

      const promoted = await sql`select 1 from works where source_url = ${c.source_url} limit 1`;
      if (promoted.length > 0) {
        console.log(`  – skipped (already promoted to works) — ${c.title}`);
        continue;
      }

      const nearDupe = await findNearDuplicate(c.title);
      if (nearDupe) {
        console.log(`  – skipped (near-duplicate: ${nearDupe}) — ${c.title}`);
        continue;
      }

      const rightsStatus = c.rights_status ?? computeRightsStatus({ publicationYear: c.year });
      const sourceTier = c.source_tier ?? sourceTierFor(c.source_url);

      await sql`
        insert into content_candidates (
          title, author_name, year, category, text_content, description,
          source_name, source_url, region, tags, reading_minutes,
          origin, status, rights_status, source_tier
        ) values (
          ${c.title}, ${c.author_name}, ${c.year}, ${c.category},
          ${c.text_content}, ${c.description}, ${c.source_name},
          ${c.source_url}, ${c.region ?? null}, ${c.tags}, ${c.reading_minutes},
          'fetch_pipeline', 'needs_review', ${rightsStatus}, ${sourceTier}
        )
      `;
      console.log(
        `  ✓ staged — [${c.category}] ${c.title} (${c.author_name}) — rights: ${rightsStatus}, tier: ${sourceTier}`
      );
    } catch (err) {
      console.error(`Failed to stage "${c.title}":`, err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  }

  console.log("Done. Run `npm run review` to see what's waiting.");
}

main();
