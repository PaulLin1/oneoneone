import { readFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { computeRightsStatus } from "@/lib/rights";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}

const sql = neon(url);

type SourcePoolEntry = {
  title: string;
  author_name: string;
  year: number;
  category: "poem" | "essay" | "story";
  source_name: string;
  source_url: string;
  region?: string;
  tags: string[];
};

const START_MARKER = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i;
const END_MARKER = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i;

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

  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`Wikisource API HTTP ${res.status}`);
  const json = (await res.json()) as { query?: { pages?: Record<string, { extract?: string }> } };
  const page = Object.values(json.query?.pages ?? {})[0];
  const extract = page?.extract?.trim() ?? "";
  if (extract.length >= 200) return extract;

  const rawRes = await fetch(`${pageUrl}${pageUrl.includes("?") ? "&" : "?"}action=raw`);
  if (!rawRes.ok) throw new Error(`Wikisource raw-wikitext HTTP ${rawRes.status}`);
  const wikitext = await rawRes.text();
  const poemMatch = wikitext.match(/<poem[^>]*>([\s\S]*?)<\/poem>/i);
  if (poemMatch) return poemMatch[1].trim();

  return extract;
}

async function fetchWorkText(entry: SourcePoolEntry): Promise<string> {
  const { hostname } = new URL(entry.source_url);
  if (hostname.endsWith("wikisource.org")) {
    return fetchFromWikisource(entry.source_url);
  }
  const res = await fetch(entry.source_url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  return stripGutenbergBoilerplate(raw);
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
  const staged = await sql`select 1 from content_candidates where source_url = ${sourceUrl} limit 1`;
  if (staged.length > 0) return true;
  const live = await sql`select 1 from works where source_url = ${sourceUrl} limit 1`;
  return live.length > 0;
}

/**
 * Exact source_url matches are caught by alreadyKnown(); this catches the
 * same work staged/promoted under a slightly different title (typo, a
 * different edition's URL) via pg_trgm similarity, in both content_candidates
 * and works. Not a hard block — logged so a human decides.
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
  const batchSize = Number(process.argv[2] ?? 3);
  const poolPath = path.join(process.cwd(), "seed", "source-pool.json");
  const pool: SourcePoolEntry[] = JSON.parse(readFileSync(poolPath, "utf-8"));

  console.log(`Source pool has ${pool.length} entries. Sampling up to ${batchSize} not yet fetched…`);

  // "Randomize while keeping quality": randomness applies to *selection*
  // within a pre-vetted pool (seed/source-pool.json), never to *what's in*
  // the pool. Grow the pool deliberately (by hand, or via an agent run like
  // the one that produced the original 30-work corpus); this script never
  // discovers new sources on its own.
  const shuffled = shuffle(pool);
  let fetched = 0;

  for (const entry of shuffled) {
    if (fetched >= batchSize) break;

    if (await alreadyKnown(entry.source_url)) {
      console.log(`  – skipped (already known) — ${entry.title}`);
      continue;
    }

    const nearDupe = await findNearDuplicate(entry.title);
    if (nearDupe) {
      console.log(`  – skipped (near-duplicate: ${nearDupe}) — ${entry.title}`);
      continue;
    }

    try {
      const text = await fetchWorkText(entry);

      if (text.length < 200) {
        throw new Error("Extracted text looks too short — boilerplate markers may not have matched.");
      }

      const readingMinutes = Math.max(1, Math.round(wordCount(text) / 200));
      const rightsStatus = computeRightsStatus({ publicationYear: entry.year });
      const sourceTier = sourceTierFor(new URL(entry.source_url).hostname);

      await sql`
        insert into content_candidates (
          title, author_name, year, category, text_content, description,
          source_name, source_url, region, tags, reading_minutes,
          origin, status, rights_status, source_tier
        ) values (
          ${entry.title}, ${entry.author_name}, ${entry.year}, ${entry.category},
          ${text}, null, ${entry.source_name}, ${entry.source_url},
          ${entry.region ?? null}, ${entry.tags}, ${readingMinutes},
          'fetch_pipeline', 'needs_review', ${rightsStatus}, ${sourceTier}
        )
      `;

      console.log(
        `  ✓ staged — [${entry.category}] ${entry.title} (${entry.author_name}) — rights: ${rightsStatus}, tier: ${sourceTier}`
      );
      fetched++;
    } catch (err) {
      console.error(`  ✗ failed — ${entry.title}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(
    fetched > 0
      ? `\nStaged ${fetched} candidate(s). Text is mechanically extracted and unreviewed — no description yet, wording hasn't been checked by a human or an agent. Run \`npm run review\` before promoting anything.`
      : "\nNothing new to fetch."
  );
}

main();
