import { readFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { computeRightsStatus } from "@/lib/rights";
import { generateDescription } from "@/lib/generateDescription";
import type { WorkCategory } from "@/lib/types";

/**
 * The mechanical half of the content pipeline — pulls from seed/source-
 * pool.json, fetches the actual text, stages it into content_candidates.
 * Shared by scripts/fetch-candidates.ts (the CLI a human or the scheduled
 * agent runs) and app/api/admin/fetch-candidates/route.ts (the button on
 * /account) — one implementation, not two that could drift apart, same
 * reasoning as lib/contentReview.ts.
 */

type SourcePoolEntry = {
  title: string;
  author_name: string;
  // Original publication year, when it's actually known. Bulk-harvested
  // entries (scripts/grow-source-pool.ts) often can't establish this
  // confidently — Gutenberg's own metadata is the *digitization* date, not
  // the work's original publication date — so this is null for those, and
  // author_death_year carries the public-domain justification instead (see
  // lib/rights.ts's isPublicDomainByAuthorDeath, the Berne life+70 floor
  // that exists specifically for this case).
  year: number | null;
  author_death_year?: number | null;
  category: WorkCategory;
  source_name: string;
  source_url: string;
  region?: string;
  tags: string[];
};

export type FetchCandidatesResult = {
  staged: { title: string; author_name: string; category: WorkCategory }[];
  skippedAlreadyKnown: number;
  skippedNearDuplicate: number;
  failed: { title: string; error: string }[];
};

const START_MARKER = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i;
const END_MARKER = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i;

// Wikimedia's API etiquette policy rate-limits requests with no User-Agent
// much more aggressively (shared anonymous-traffic bucket) — see
// https://meta.wikimedia.org/wiki/User-Agent_policy. Without this, a run
// touching several Wikisource entries in a row could genuinely get
// rate-limited (HTTP 429) partway through, same as a missing per-request
// delay — see the pacing note in the main loop below.
const USER_AGENT = "oneoneone-content-fetch/1.0 (https://github.com/PaulLin1/oneoneone)";

function stripGutenbergBoilerplate(raw: string): string {
  const startMatch = raw.match(START_MARKER);
  const endMatch = raw.match(END_MARKER);
  const start = startMatch ? startMatch.index! + startMatch[0].length : 0;
  const end = endMatch ? endMatch.index! : raw.length;
  return raw.slice(start, end).trim();
}

/**
 * Wikisource pages are wikitext/HTML, not plain text — a bare fetch() would
 * stage raw markup as text_content. MediaWiki's own plaintext-extraction API
 * handles the common case (single-page prose articles) cleanly; some poem
 * pages wrap their text in a literal <poem>...</poem> tag that the extracts
 * API renders empty for, so those get a second attempt against raw wikitext,
 * pulled out the same way stripGutenbergBoilerplate pulls text from between
 * START/END markers. Pages built from transcluded scans (<pages index=...>)
 * aren't handled — they fail cleanly and get skipped, same as any other
 * extraction failure below.
 */
async function fetchFromWikisource(pageUrl: string): Promise<string> {
  const { hostname, pathname } = new URL(pageUrl);
  const title = decodeURIComponent(pathname.replace(/^\/wiki\//, ""));
  const apiUrl = `https://${hostname}/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(title)}`;

  const res = await fetch(apiUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Wikisource API HTTP ${res.status}`);
  const json = (await res.json()) as { query?: { pages?: Record<string, { extract?: string }> } };
  const page = Object.values(json.query?.pages ?? {})[0];
  const extract = page?.extract?.trim() ?? "";
  if (extract.length >= 200) return extract;

  const rawRes = await fetch(`${pageUrl}${pageUrl.includes("?") ? "&" : "?"}action=raw`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!rawRes.ok) throw new Error(`Wikisource raw-wikitext HTTP ${rawRes.status}`);
  const wikitext = await rawRes.text();
  const poemMatch = wikitext.match(/<poem[^>]*>([\s\S]*?)<\/poem>/i);
  if (poemMatch) return poemMatch[1].trim();

  return extract;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One retry, after a real pause, specifically for 429 — a rate-limit is a
 * "you were too fast," not "this source is bad" error, and treating the
 * two the same means a run touching several Wikisource entries in a row
 * can spuriously fail entries whose URL is perfectly fine.
 */
async function fetchWorkText(entry: SourcePoolEntry): Promise<string> {
  const { hostname } = new URL(entry.source_url);
  const fetchOnce = (): Promise<string> =>
    hostname.endsWith("wikisource.org")
      ? fetchFromWikisource(entry.source_url)
      : fetch(entry.source_url, { headers: { "User-Agent": USER_AGENT } }).then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return stripGutenbergBoilerplate(await res.text());
        });

  try {
    return await fetchOnce();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("429")) throw err;
    await sleep(3000);
    return fetchOnce();
  }
}

function sourceTierFor(hostname: string): "high_trust" | "standard" | "ocr_unverified" {
  if (hostname.endsWith("standardebooks.org")) return "high_trust";
  if (hostname.endsWith("gutenberg.org") || hostname.endsWith("wikisource.org")) return "standard";
  return "ocr_unverified"; // e.g. archive.org OCR text — always flagged for extra reviewer scrutiny
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function alreadyKnown(sourceUrl: string): Promise<boolean> {
  const sql = getDb();
  const staged = (await sql`select 1 from content_candidates where source_url = ${sourceUrl} limit 1`) as unknown[];
  if (staged.length > 0) return true;
  const live = (await sql`select 1 from works where source_url = ${sourceUrl} limit 1`) as unknown[];
  return live.length > 0;
}

/**
 * Exact source_url matches are caught by alreadyKnown(); this catches the
 * same work staged/promoted under a slightly different title (typo, a
 * different edition's URL) via pg_trgm similarity, in both content_candidates
 * and works. Not a hard block — logged so a human decides.
 */
async function findNearDuplicate(title: string): Promise<string | null> {
  const sql = getDb();
  const rows = (await sql`
    select title, 'candidate' as where_found from content_candidates
    where similarity(title, ${title}) > 0.6
    union all
    select title, 'work' as where_found from works
    where similarity(title, ${title}) > 0.6
    limit 1
  `) as { title: string; where_found: string }[];
  if (rows.length === 0) return null;
  return `"${rows[0].title}" already in ${rows[0].where_found}`;
}

/**
 * perCategoryLimit applies separately to poem/essay/story — a limit of 7
 * means up to 7 of each (21 total), not 7 total split unevenly across
 * whichever category happens to shuffle first.
 */
export async function fetchCandidates(perCategoryLimit: number): Promise<FetchCandidatesResult> {
  const sql = getDb();
  const poolPath = path.join(process.cwd(), "seed", "source-pool.json");
  const pool: SourcePoolEntry[] = JSON.parse(readFileSync(poolPath, "utf-8"));

  console.log(`Source pool has ${pool.length} entries. Sampling up to ${perCategoryLimit} of each category…`);

  // "Randomize while keeping quality": randomness applies to *selection*
  // within a pre-vetted pool (seed/source-pool.json), never to *what's in*
  // the pool. Grow the pool deliberately (by hand, or via an agent run like
  // the one that produced the original 30-work corpus); this never
  // discovers new sources on its own.
  const shuffled = shuffle(pool);
  const result: FetchCandidatesResult = {
    staged: [],
    skippedAlreadyKnown: 0,
    skippedNearDuplicate: 0,
    failed: [],
  };
  const stagedByCategory: Record<WorkCategory, number> = { poem: 0, essay: 0, story: 0 };

  for (const [i, entry] of shuffled.entries()) {
    const full = (Object.keys(stagedByCategory) as WorkCategory[]).every(
      (c) => stagedByCategory[c] >= perCategoryLimit
    );
    if (full) break;
    if (stagedByCategory[entry.category] >= perCategoryLimit) continue;

    // Stay polite to Wikimedia's API (see USER_AGENT comment above) — a
    // burst of same-second requests is what triggers the 429s the retry in
    // fetchWorkText exists to paper over; better to just not trigger them.
    if (i > 0) await sleep(300);

    if (await alreadyKnown(entry.source_url)) {
      console.log(`  – skipped (already known) — ${entry.title}`);
      result.skippedAlreadyKnown++;
      continue;
    }

    const nearDupe = await findNearDuplicate(entry.title);
    if (nearDupe) {
      console.log(`  – skipped (near-duplicate: ${nearDupe}) — ${entry.title}`);
      result.skippedNearDuplicate++;
      continue;
    }

    try {
      const text = await fetchWorkText(entry);

      if (text.length < 200) {
        throw new Error("Extracted text looks too short — boilerplate markers may not have matched.");
      }

      const readingMinutes = Math.max(1, Math.round(wordCount(text) / 200));
      const rightsStatus = computeRightsStatus({
        publicationYear: entry.year,
        authorDeathYear: entry.author_death_year ?? null,
      });
      const sourceTier = sourceTierFor(new URL(entry.source_url).hostname);
      // Best-effort — a reviewer can still edit this in /admin/review
      // regardless of whether generation succeeded (see generateDescription's
      // own doc comment for why this never blocks staging).
      const description = await generateDescription({
        title: entry.title,
        authorName: entry.author_name,
        category: entry.category,
        text,
      });

      await sql`
        insert into content_candidates (
          title, author_name, year, category, text_content, description,
          source_name, source_url, region, tags, reading_minutes,
          origin, status, rights_status, source_tier
        ) values (
          ${entry.title}, ${entry.author_name}, ${entry.year}, ${entry.category},
          ${text}, ${description}, ${entry.source_name}, ${entry.source_url},
          ${entry.region ?? null}, ${entry.tags}, ${readingMinutes},
          'fetch_pipeline', 'needs_review', ${rightsStatus}, ${sourceTier}
        )
      `;

      console.log(
        `  ✓ staged — [${entry.category}] ${entry.title} (${entry.author_name}) — rights: ${rightsStatus}, tier: ${sourceTier}` +
          (description ? "" : " (no description generated — edit it in review)")
      );
      result.staged.push({ title: entry.title, author_name: entry.author_name, category: entry.category });
      stagedByCategory[entry.category]++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ failed — ${entry.title}:`, message);
      result.failed.push({ title: entry.title, error: message });
    }
  }

  console.log(
    result.staged.length > 0
      ? `\nStaged ${result.staged.length} candidate(s). Text is mechanically extracted and unreviewed — no description yet, wording hasn't been checked by a human or an agent. Run \`npm run review\` before promoting anything.`
      : "\nNothing new to fetch."
  );

  return result;
}
