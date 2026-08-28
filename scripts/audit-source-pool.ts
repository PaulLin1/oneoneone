import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Re-verifies every EXISTING seed/source-pool.json entry against its own
 * stored source_url — not rediscovery, just "does this URL still resolve
 * to real, substantial, single-work text?" Found two entries from an
 * earlier (agent-verified) pipeline run that were actually scanned-page
 * transclusions (<pages index=...>), which is exactly the class of error
 * this catches. Removes anything that fails; nothing is added here.
 *
 * Run: npx tsx scripts/audit-source-pool.ts
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

const USER_AGENT = "oneoneone-pool-audit/1.0 (https://github.com/PaulLin1/oneoneone)";
const MIN_POEM_CHARS = 300;
const MIN_PROSE_CHARS = 2000;
const MAX_CHARS = 200_000;

const START_MARKER = /\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i;
const END_MARKER = /\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[.,()]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 2); // drop initials/short particles ("H.", "de") — too likely to false-match
}

/**
 * The bug this exists to catch: a search can return a page whose TEXT is
 * long enough and doesn't look like a versions index, but is simply the
 * wrong work — Wikisource's search matched on a shared word, not the
 * actual title. Verified against a real title (source_url pointed at
 * Robert Service's "The Man from Eldorado" for a pool entry titled
 * "Eldorado" credited to Poe; another pointed at a Dunbar poem for a
 * title credited to Poe) neither of which any length/structure check
 * alone would ever catch. This requires at least one non-trivial author
 * name token to actually appear in the text — not proof of correctness,
 * but a real, cheap check that would have caught both of those.
 */
function authorTokenPresent(authorName: string, text: string): boolean {
  const tokens = nameTokens(authorName);
  if (tokens.length === 0) return true; // nothing meaningful to check (e.g. "Anonymous")
  const lower = text.toLowerCase();
  return tokens.some((t) => lower.includes(t));
}

async function fetchWithRetry(url: string, init: RequestInit, retriesLeft = 2): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 429 && retriesLeft > 0) {
    await sleep(3000);
    return fetchWithRetry(url, init, retriesLeft - 1);
  }
  return res;
}

async function verifyGutenberg(url: string, minLen: number, authorName: string): Promise<string | null> {
  // A Gutenberg audiobook recording's companion readme has valid START/END
  // markers (Gutenberg wraps every text file the same way), is short
  // enough to pass a poem's length floor, and mentions the author by name
  // — every other check below would pass it. Real incident: a bulk harvest
  // added "The Odyssey," "Sonnets," and a dozen others this way before this
  // check existed. See scripts/grow-source-pool.ts's matching comment.
  if (/readme/i.test(url)) return "URL is a Gutenberg audiobook readme, not the actual work";

  const res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return `HTTP ${res.status}`;
  const raw = await res.text();
  const startMatch = raw.match(START_MARKER);
  const endMatch = raw.match(END_MARKER);
  if (!startMatch || !endMatch) return "not a Gutenberg plaintext ebook page (no START/END markers)";
  const body = raw.slice(startMatch.index! + startMatch[0].length, endMatch.index!).trim();
  if (body.length < minLen) return `extracted text too short (${body.length} chars)`;
  if (body.length > MAX_CHARS) return `extracted text too long (${body.length} chars) — likely a whole book`;
  // Check the pre-START metadata block too (Gutenberg often puts
  // Title:/Author: lines there), not just the body — some editions don't
  // repeat the byline inside the text itself.
  if (!authorTokenPresent(authorName, raw.slice(0, startMatch.index! + 3000))) {
    return `author "${authorName}" not found anywhere near the start of the text — likely the wrong work`;
  }
  return null;
}

async function verifyWikisource(url: string, category: WorkCategory, authorName: string): Promise<string | null> {
  const minLen = category === "poem" ? MIN_POEM_CHARS : MIN_PROSE_CHARS;
  const page = decodeURIComponent(new URL(url).pathname.replace(/^\/wiki\//, ""));

  const rawUrl = `${url}${url.includes("?") ? "&" : "?"}action=raw`;
  const rawRes = await fetchWithRetry(rawUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!rawRes.ok) return `raw wikitext HTTP ${rawRes.status}`;
  const raw = await rawRes.text();
  if (/<pages\s+index=/i.test(raw)) return "scanned-page transclusion (<pages index=...>) — can't be extracted mechanically";

  // The actual bug this whole function exists to catch: a page can be
  // long enough and structurally fine and still be the WRONG work — the
  // search matched on a shared word, not the real title. The {{header}}
  // template's explicit author= field is the strongest signal available;
  // if it's present and doesn't match, that's a hard reject regardless of
  // anything else. If it's blank/inherited (a sub-page using [[../]]),
  // fall back to checking the raw wikitext broadly — and if the author
  // genuinely doesn't appear anywhere, fail closed rather than guess.
  const authorField = raw.match(/\|\s*author\s*=\s*([^\n|}]+)/i)?.[1]?.trim();
  if (authorField && !/^\[\[\.\.\/?\]?\]?$/.test(authorField)) {
    if (!authorTokenPresent(authorName, authorField)) {
      return `page's own author field says "${authorField}", not "${authorName}" — wrong work`;
    }
  } else if (!authorTokenPresent(authorName, raw)) {
    return `author "${authorName}" not found anywhere on the page (and no explicit author= field to check) — can't confirm this is the right work`;
  }

  const extractUrl = `https://en.wikisource.org/w/api.php?${new URLSearchParams({
    action: "query",
    prop: "extracts",
    explaintext: "1",
    redirects: "1",
    format: "json",
    titles: page,
  })}`;
  const extractRes = await fetchWithRetry(extractUrl, { headers: { "User-Agent": USER_AGENT } });
  const extractJson = (await extractRes.json()) as { query?: { pages?: Record<string, { extract?: string }> } };
  const extract = Object.values(extractJson.query?.pages ?? {})[0]?.extract?.trim() ?? "";
  // A versions/disambiguation page's *entire* content is a short citation
  // list — checking only the first ~500 chars (not the whole extract)
  // avoids false-positiving on a long real story that happens to contain
  // quoted dialogue somewhere in its many thousands of characters.
  const looksLikeVersionsIndex = /"[^"]+"\s*(?:in|,)\s|==\s*See also\s*==/i.test(extract.slice(0, 500));
  if (extract.length >= minLen && !looksLikeVersionsIndex) return null;

  const poemMatch = raw.match(/<poem[^>]*>([\s\S]*?)<\/poem>/i);
  if (poemMatch && poemMatch[1].trim().length >= minLen) return null;

  return `extracted text too short (extract API: ${extract.length} chars, no usable <poem> tag either)`;
}

async function main() {
  const poolPath = path.join(process.cwd(), "seed", "source-pool.json");
  const pool: SourcePoolEntry[] = JSON.parse(readFileSync(poolPath, "utf-8"));

  console.log(`Auditing ${pool.length} pool entries against their stored source_url…\n`);

  const good: SourcePoolEntry[] = [];
  const bad: { title: string; reason: string }[] = [];

  for (const [i, entry] of pool.entries()) {
    if (i > 0) await sleep(400);
    const hostname = new URL(entry.source_url).hostname;
    const minLen = entry.category === "poem" ? MIN_POEM_CHARS : MIN_PROSE_CHARS;
    const problem = hostname.endsWith("wikisource.org")
      ? await verifyWikisource(entry.source_url, entry.category, entry.author_name)
      : await verifyGutenberg(entry.source_url, minLen, entry.author_name);

    if (problem) {
      console.log(`  ✗ ${entry.category.padEnd(6)} — ${entry.title}: ${problem}`);
      bad.push({ title: entry.title, reason: problem });
    } else {
      console.log(`  ✓ ${entry.category.padEnd(6)} — ${entry.title}`);
      good.push(entry);
    }
  }

  if (bad.length > 0) {
    writeFileSync(poolPath, JSON.stringify(good, null, 2) + "\n");
  }

  console.log(`\n${good.length} verified OK, ${bad.length} removed:`);
  for (const b of bad) console.log(`  - ${b.title} (${b.reason})`);
}

main();
