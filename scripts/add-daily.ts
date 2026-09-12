import { readFileSync } from "node:fs";
import { getDb } from "@/lib/db";
import { computeRightsStatus } from "@/lib/rights";
import { generateDescription } from "@/lib/generateDescription";
import { promoteCandidate, ERAS, DIFFICULTIES, type Era, type Difficulty } from "@/lib/contentReview";
import { recordDailyPick } from "@/lib/dailyPicks";
import { globalDayNumber } from "@/lib/epoch";
import type { WorkCategory } from "@/lib/types";

/**
 * The one primitive the daily pipeline (and a human, by hand) uses to put a
 * work live for a specific day: stage it as a candidate, promote it through
 * the exact same rules as any other promotion (lib/contentReview.ts), then
 * pin it to (date, category) in daily_picks. No separate review step — this
 * IS the automated path.
 *
 *   npm run add-daily -- \
 *     --date=2026-09-08 --category=poem \
 *     --title="…" --author="…" --year=1898 \
 *     --source-name="Project Gutenberg" --source-url="https://…" \
 *     --text-file=/tmp/poem.txt \
 *     [--description="…"]  (omitted → generated via ANTHROPIC_API_KEY) \
 *     [--era=19th_century] (omitted → computed from --year) \
 *     [--difficulty=medium] [--region="England"] [--tags=grief,nature] \
 *     [--author-death-year=1930] [--force-pd] [--reading-minutes=N]
 */

const CATEGORIES: WorkCategory[] = ["poem", "essay", "story"];

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) flags[arg.slice(2)] = "true";
    else flags[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  return flags;
}

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

function eraForYear(year: number | null): Era | undefined {
  if (year === null) return undefined;
  if (year < 1800) return "ancient";
  if (year < 1900) return "19th_century";
  if (year < 1930) return "early_20th_century";
  return "modern";
}

function sourceTierFor(hostname: string): "high_trust" | "standard" | "ocr_unverified" {
  if (hostname.endsWith("standardebooks.org")) return "high_trust";
  if (hostname.endsWith("gutenberg.org") || hostname.endsWith("wikisource.org")) return "standard";
  return "ocr_unverified";
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

async function main() {
  if (!process.env.DATABASE_URL) die("Missing DATABASE_URL environment variable.");

  const f = parseFlags(process.argv.slice(2));

  const date = f.date ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) die("--date=YYYY-MM-DD is required.");
  if (globalDayNumber(date) < 1) die(`--date ${date} is before the epoch (see lib/epoch.ts).`);

  const category = f.category as WorkCategory;
  if (!CATEGORIES.includes(category)) die(`--category must be one of: ${CATEGORIES.join(", ")}`);

  const title = f.title?.trim();
  const author = f.author?.trim();
  const sourceName = f["source-name"]?.trim();
  const sourceUrl = f["source-url"]?.trim();
  if (!title || !author || !sourceName || !sourceUrl) {
    die("--title, --author, --source-name, and --source-url are all required.");
  }

  const textFile = f["text-file"];
  const text = (textFile ? readFileSync(textFile, "utf-8") : (f.text ?? "")).trim();
  if (text.length < 200) die("Text is missing or too short — pass --text-file=<path> to clean, full text.");

  const year = f.year ? Number(f.year) : null;
  if (f.year && !Number.isInteger(year)) die("--year must be an integer.");
  const authorDeathYear = f["author-death-year"] ? Number(f["author-death-year"]) : null;

  const era = (f.era as Era | undefined) ?? eraForYear(year);
  if (era && !ERAS.includes(era)) die(`--era must be one of: ${ERAS.join(", ")}`);
  const difficulty = (f.difficulty as Difficulty | undefined) ?? "medium";
  if (!DIFFICULTIES.includes(difficulty)) die(`--difficulty must be one of: ${DIFFICULTIES.join(", ")}`);

  const tags = f.tags ? f.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) : [];
  const region = f.region?.trim() || null;
  const readingMinutes = f["reading-minutes"]
    ? Number(f["reading-minutes"])
    : Math.max(1, Math.round(wordCount(text) / 200));

  const rightsStatus = computeRightsStatus({ publicationYear: year, authorDeathYear });
  const sourceTier = sourceTierFor(new URL(sourceUrl).hostname);

  let description = f.description?.trim() || null;
  if (!description) {
    description = await generateDescription({ title, authorName: author, category, text });
    if (!description) {
      die("No --description given and generation failed (ANTHROPIC_API_KEY?). Pass --description explicitly.");
    }
  }

  const sql = getDb();

  // Upsert on source_url (content_candidates_source_url_key) so re-running a
  // date doesn't collide — just refresh the staged row and re-promote it.
  const staged = (await sql`
    insert into content_candidates (
      title, author_name, year, category, text_content, description,
      source_name, source_url, region, tags, reading_minutes,
      origin, status, rights_status, source_tier
    ) values (
      ${title}, ${author}, ${year}, ${category}, ${text}, ${description},
      ${sourceName}, ${sourceUrl}, ${region}, ${tags}, ${readingMinutes},
      'fetch_pipeline', 'needs_review', ${rightsStatus}, ${sourceTier}
    )
    on conflict (source_url) do update set
      title = excluded.title, author_name = excluded.author_name,
      year = excluded.year, category = excluded.category,
      text_content = excluded.text_content, description = excluded.description,
      source_name = excluded.source_name, region = excluded.region,
      tags = excluded.tags, reading_minutes = excluded.reading_minutes,
      rights_status = excluded.rights_status, source_tier = excluded.source_tier,
      status = 'needs_review', promoted_work_id = null, reviewed_at = null
    returning id
  `) as unknown as { id: string }[];
  const candidateId = staged[0].id;

  const result = await promoteCandidate(candidateId, {
    era,
    difficulty,
    forcePd: f["force-pd"] === "true",
  });
  if ("error" in result) die(`Promotion failed: ${result.error}`);

  await recordDailyPick(date, category, result.workId);

  console.log(
    `✓ Day ${globalDayNumber(date)} (${date}) · ${category} → "${title}" by ${author}\n` +
      `  work ${result.workId} · rights ${rightsStatus} · era ${era ?? "(unset)"} · ${difficulty} · ${readingMinutes} min`
  );
}

main();
