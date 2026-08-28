import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isPublicDomainByAuthorDeath } from "@/lib/rights";

/**
 * Bulk-harvests source-pool candidates from Project Gutenberg's own topic
 * catalog (via gutendex.com's structured API) instead of guessing whether
 * a specific well-known title happens to have a standalone edition. That
 * guessing approach (an earlier version of this script) had a poor hit
 * rate — most famous individual poems/essays/stories are only published
 * bundled into "Complete Works" collections, not standalone, so checking
 * titles one at a time mostly produces misses. Browsing what Gutenberg
 * actually has, then filtering for standalone-looking entries, finds far
 * more real candidates.
 *
 * This also drops Wikisource entirely. Wikisource's free-text search
 * doesn't reliably return the actual requested work — a real incident
 * from the previous approach: searching for "Eldorado" credited to Poe
 * matched and (before an author check was added) nearly passed on Robert
 * Service's unrelated "The Man from Eldorado" purely on a shared word.
 * Gutenberg's structured metadata (real authors[], real formats[] with a
 * direct plain-text URL, no guessing file-name patterns) doesn't have
 * that failure mode.
 *
 * Rights: most harvested entries won't have a confidently-known ORIGINAL
 * publication year (Gutenberg's own metadata is the digitization date,
 * not the work's date) — this uses the author's death year instead, via
 * the same life+70 rule lib/rights.ts already supports but the old
 * hand-picked pool never needed (every hand-picked entry had a known
 * year). year is stored as null for these; author_death_year carries the
 * actual public-domain justification through to fetch-candidates.ts.
 *
 * Run: npx tsx scripts/grow-source-pool.ts
 */

type WorkCategory = "poem" | "essay" | "story";

type SourcePoolEntry = {
  title: string;
  author_name: string;
  year: number | null;
  author_death_year?: number | null;
  category: WorkCategory;
  source_name: string;
  source_url: string;
  region: string;
  tags: string[];
};

type GutendexBook = {
  id: number;
  title: string;
  authors: { name: string; death_year: number | null }[];
  subjects: string[];
  languages: string[];
  formats: Record<string, string>;
  media_type: string;
};

const USER_AGENT = "oneoneone-pool-growth/2.0 (https://github.com/PaulLin1/oneoneone)";
const TARGET_PER_CATEGORY = 15; // aim well past the 7-per-fetch the account button uses, for real headroom
const PAGES_PER_TOPIC = 14; // 32 results/page — ~450 candidates per category to filter+verify from
const MAX_CHARS = { poem: 8_000, essay: 60_000, story: 80_000 };
const MIN_CHARS = { poem: 200, essay: 1_500, story: 1_500 };

const START_MARKER = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i;
const END_MARKER = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i;

// Title patterns that reliably signal "this is a collection/anthology/
// multi-volume set, not a single work" — the bulk of what a topic browse
// returns, and the main thing standing between "browse the catalog" and
// "browse the catalog and only keep single works."
const COLLECTION_TITLE = /\b(complete|collected|selected)\b|works of|anthology|omnibus|\bvolume\b|\bvol\.?\s*\d|\bbook\s+\d|and other (poems|stories|tales|essays|papers)|\bseries\b|\blibrary\b|\bmagazine\b|\bquarterly\b|\breview\b|--\s*volume|:\s*volume|\bletters (of|to)\b|table of contents/i;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url: string, retriesLeft = 2): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 429 && retriesLeft > 0) {
    await sleep(3000);
    return getJson(url, retriesLeft - 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[.,()]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Bare lowercase-equality missed a real near-duplicate: a Gutenberg entry
 * titled "The Monkey's Paw: The Lady of the Barge and Others, Part 2."
 * slipped through against a known "The Monkey's Paw" because the strings
 * simply aren't equal. Comparing just the part before a colon (where
 * Gutenberg's own subtitle/collection-context noise usually lives) catches
 * that without needing full fuzzy matching.
 */
function normalizeTitle(title: string): string {
  return title.split(":")[0]!.toLowerCase().trim();
}

function authorTokenPresent(authorName: string, text: string): boolean {
  const tokens = nameTokens(authorName);
  if (tokens.length === 0) return true;
  const lower = text.toLowerCase();
  return tokens.some((t) => lower.includes(t));
}

/** Library-of-Congress-style subjects ("Fantasy fiction -- Juvenile") → a few clean lowercase tags. */
function tagsFromSubjects(subjects: string[]): string[] {
  return [...new Set(subjects.map((s) => s.split(" -- ")[0]?.toLowerCase().trim()).filter((s): s is string => !!s && s.length < 30))].slice(0, 4);
}

async function fetchTopicPages(topic: string, pages: number): Promise<GutendexBook[]> {
  const books: GutendexBook[] = [];
  let url: string | null = `https://gutendex.com/books/?${new URLSearchParams({ topic, languages: "en" })}`;
  for (let p = 0; p < pages && url; p++) {
    if (p > 0) await sleep(500);
    const data = (await getJson(url)) as { results: GutendexBook[]; next: string | null };
    books.push(...data.results);
    url = data.next;
  }
  return books;
}

async function verifyAndBuildEntry(
  book: GutendexBook,
  category: WorkCategory
): Promise<SourcePoolEntry | { title: string; reason: string }> {
  const author = book.authors[0];
  if (!author) return { title: book.title, reason: "no author listed" };
  if (author.death_year === null) return { title: book.title, reason: "author death year unknown — can't confirm public domain" };
  if (!isPublicDomainByAuthorDeath(author.death_year)) {
    return { title: book.title, reason: `author died ${author.death_year} — not yet public domain (life+70 rule)` };
  }

  const textUrl = book.formats["text/plain; charset=utf-8"] ?? book.formats["text/plain; charset=us-ascii"] ?? book.formats["text/plain"];
  if (!textUrl) return { title: book.title, reason: "no plain-text format available" };
  // Belt-and-suspenders on top of the media_type check in main() — a
  // readme file is never the actual work regardless of how it got here.
  if (/readme/i.test(textUrl)) return { title: book.title, reason: "text URL is a readme, not the actual work" };

  const res = await fetch(textUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return { title: book.title, reason: `text fetch HTTP ${res.status}` };
  const raw = await res.text();
  const startMatch = raw.match(START_MARKER);
  const endMatch = raw.match(END_MARKER);
  if (!startMatch || !endMatch) return { title: book.title, reason: "not a real Gutenberg plaintext file (no START/END markers)" };
  const body = raw.slice(startMatch.index! + startMatch[0].length, endMatch.index!).trim();

  if (body.length < MIN_CHARS[category]) return { title: book.title, reason: `too short (${body.length} chars) — probably not the real text` };
  if (body.length > MAX_CHARS[category]) return { title: book.title, reason: `too long (${body.length} chars) — likely a collection, not a single work` };
  if (!authorTokenPresent(author.name, raw.slice(0, startMatch.index! + 3000))) {
    return { title: book.title, reason: `author "${author.name}" not found near the start of the text — metadata may be wrong` };
  }

  return {
    title: book.title,
    author_name: author.name,
    year: null,
    author_death_year: author.death_year,
    category,
    source_name: "Project Gutenberg",
    source_url: textUrl,
    region: "",
    tags: tagsFromSubjects(book.subjects),
  };
}

async function main() {
  const poolPath = path.join(process.cwd(), "seed", "source-pool.json");
  const worksPath = path.join(process.cwd(), "seed", "works.json");
  const pool: SourcePoolEntry[] = JSON.parse(readFileSync(poolPath, "utf-8"));
  const works: { title: string }[] = JSON.parse(readFileSync(worksPath, "utf-8"));
  const knownTitles = new Set([...pool.map((p) => normalizeTitle(p.title)), ...works.map((w) => normalizeTitle(w.title))]);
  const knownUrls = new Set(pool.map((p) => p.source_url));

  const topics: [string, WorkCategory][] = [
    ["Poetry", "poem"],
    ["Essays", "essay"],
    ["Short stories", "story"],
  ];

  const added: SourcePoolEntry[] = [];
  const failedCounts: Record<WorkCategory, number> = { poem: 0, essay: 0, story: 0 };

  for (const [topic, category] of topics) {
    console.log(`\n=== ${category} (topic: ${topic}) ===`);
    const books = await fetchTopicPages(topic, PAGES_PER_TOPIC);
    console.log(`Fetched ${books.length} candidates from Gutenberg's "${topic}" topic.`);

    let addedThisCategory = 0;
    for (const [i, book] of books.entries()) {
      if (addedThisCategory >= TARGET_PER_CATEGORY) break;
      // Most of a topic browse gets filtered out (collections, dupes,
      // already-known), so without this a run can go minutes with zero
      // output and look hung even though it's working — this is exactly
      // what made a real run get killed mid-way earlier this session.
      if (i > 0 && i % 50 === 0) {
        console.log(`  … checked ${i}/${books.length}, ${addedThisCategory} added so far`);
      }
      // Gutenberg catalogs audiobook recordings as their own entries, tagged
      // with the same subject/topic as the text edition (since they're an
      // audio recording OF that poetry/essay/story). Their only "text/plain"
      // format is a short readme *about the recording*, not the work's
      // actual text — and that readme is short and mentions the author by
      // name, so it was quietly passing every other check. This is the real
      // fix (not a URL-pattern guess): Gutenberg's own media_type field.
      if (book.media_type !== "Text") continue;
      if (COLLECTION_TITLE.test(book.title)) continue;
      if (knownTitles.has(normalizeTitle(book.title))) continue;
      if (!book.languages.includes("en")) continue;

      if (i > 0) await sleep(400);
      const result = await verifyAndBuildEntry(book, category);
      if ("source_url" in result) {
        if (knownUrls.has(result.source_url)) continue;
        console.log(`  ✓ ${book.title} (${result.author_name}, d. ${result.author_death_year})`);
        added.push(result);
        knownTitles.add(normalizeTitle(result.title));
        knownUrls.add(result.source_url);
        addedThisCategory++;
      } else {
        failedCounts[category]++;
        // Only log rejections at a glance — most of a topic browse is
        // collections/multi-volume sets, which is expected, not a
        // problem to investigate one by one.
      }
    }
    console.log(`Added ${addedThisCategory} verified ${category} entries.`);
  }

  if (added.length > 0) {
    const updated = [...pool, ...added];
    writeFileSync(poolPath, JSON.stringify(updated, null, 2) + "\n");
  }

  const byCategory = { poem: 0, essay: 0, story: 0 } as Record<WorkCategory, number>;
  for (const a of added) byCategory[a.category]++;

  console.log(
    `\nAdded ${added.length} verified entries (poem: ${byCategory.poem}, essay: ${byCategory.essay}, story: ${byCategory.story}). ` +
      `Rejected during filtering (title patterns, length, author checks): poem ${failedCounts.poem}, essay ${failedCounts.essay}, story ${failedCounts.story}. ` +
      `Pool is now ${pool.length + added.length} entries total.`
  );
}

main();
