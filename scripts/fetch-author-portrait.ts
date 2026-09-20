import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { authorSlug } from "@/lib/authorPortraits";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}

const sql = neon(url);

const SOURCE_DIR = path.join(process.cwd(), "public", "authors", "_source");
const STAGING_DIR = path.join(process.cwd(), "public", "authors", "_staging");

/** How many candidate images to download per author for the processing step to pick from. */
const MAX_CANDIDATES = 8;

type WikipediaSummary = {
  extract?: string;
  description?: string;
  originalimage?: { source: string };
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
};

type Candidate = {
  url: string;
  source: "wikipedia" | "commons";
  width: number;
  height: number;
  /** Commons file title, used only for ranking; "" for the Wikipedia lead image. */
  title: string;
};

/**
 * `description` (Wikidata-backed short description, e.g. "American writer
 * and critic (1809–1849)") carries the years reliably — the plaintext
 * `extract` field strips parentheticals entirely, so it's not usable for
 * this. Best-effort: unusual cases (co-written pages, "c. 1800", a
 * still-living person with an open-ended range) just come back null, same
 * as any field a human would need to fill in by hand.
 */
function parseLifespan(description: string): { birthYear: number | null; deathYear: number | null } {
  const match = description.match(/\(([^)]*)\)/);
  if (!match) return { birthYear: null, deathYear: null };
  const years = match[1].match(/\d{4}/g);
  if (!years || years.length < 2) return { birthYear: null, deathYear: null };
  return { birthYear: Number(years[0]), deathYear: Number(years[1]) };
}

// Wikimedia's API etiquette policy rate-limits requests with no User-Agent
// much more aggressively (shared anonymous-traffic bucket) — see
// https://meta.wikimedia.org/wiki/User-Agent_policy. A real UA with contact
// info is what keeps this script off that bucket.
const USER_AGENT = "oneoneone-author-portrait-fetch/1.0 (https://github.com/PaulLin1/oneoneone)";

/**
 * Retries once, after a short delay, on a transient failure — a network
 * error, or an HTTP 5xx from Wikipedia/Commons — never on a 4xx, which is a
 * real "not found" the caller needs to see immediately, not a blip. On the
 * final attempt, whatever response (or error) came back is what the caller
 * sees, same as a single unretried fetch would give them.
 */
async function fetchWithRetry(url: string | URL, init?: RequestInit, attempts = 2): Promise<Response> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status < 500 || attempt === attempts) return res;
    } catch (err) {
      if (attempt === attempts) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
  }
  throw new Error("fetchWithRetry: exhausted attempts");
}

async function fetchSummaryFor(title: string): Promise<Response> {
  return fetchWithRetry(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    { headers: { "User-Agent": USER_AGENT } }
  );
}

/**
 * Catalog author names sometimes carry a curator-added disambiguator, e.g.
 * "Saki (H. H. Munro)" — Wikipedia's actual article title is just "Saki".
 * On a 404, retry once with the parenthetical stripped before giving up.
 */
async function fetchSummary(name: string): Promise<WikipediaSummary | null> {
  let res = await fetchSummaryFor(name);
  if (res.status === 404) {
    const stripped = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (stripped !== name) res = await fetchSummaryFor(stripped);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Wikipedia summary API HTTP ${res.status}`);
  return res.json();
}

const PD_LICENSE = /^(pd|cc0)/i;
const PD_LICENSE_NAME = /public domain|cc0|no known copyright|no restrictions|pd-art|pd-old|pd-us/i;
const USABLE_MIME = /^image\/(jpeg|png|tiff)$/;

// Title words that mean "not a head-and-shoulders of this person": monuments,
// memorabilia, buildings, documents, group scenes.
const NON_PORTRAIT_TITLE =
  /\b(statue|sculpture|bust|plaque|medal|medallion|coin|banknote|stamp|grave|headstone|tomb|memorial|birthplace|house|cottage|church|building|hall|signature|letter|manuscript|autograph|caricature|cartoon|silhouette|family|children|group)\b/i;
// Title words that mean "someone already cropped this to the face" — exactly
// what thresholds cleanest, so these jump the queue.
const PRECROPPED_TITLE = /\b(cropped|detail|head|face)\b/i;

/**
 * Wikimedia Commons full-text search for portraits of this author, kept to
 * files whose *own* license is public domain / CC0 (an author being out of
 * copyright says nothing about a given photograph of them).
 *
 * Only two negative terms: Commons' search degrades badly once you stack
 * more than a few (`-a -b -c -d -e -f` was returning 2–3 hits total for
 * even very well-photographed authors), so the rest of the junk is dropped
 * by NON_PORTRAIT_TITLE afterwards instead. process-author-portraits.ts
 * scores whatever survives; this just orders the queue so the best bets
 * download first within MAX_CANDIDATES.
 */
async function fetchCommonsCandidates(name: string): Promise<Candidate[]> {
  const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
  endpoint.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `${name} portrait -statue -stamp`,
    gsrnamespace: "6",
    gsrlimit: "40",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
  }).toString();

  const res = await fetchWithRetry(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Commons search API HTTP ${res.status}`);
  const body = (await res.json()) as {
    query?: { pages?: Record<string, { title?: string; imageinfo?: Array<Record<string, unknown>> }> };
  };

  const pages = Object.values(body.query?.pages ?? {});
  const candidates: Candidate[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info) continue;

    const title = String(page.title ?? "").replace(/^File:/, "");
    if (NON_PORTRAIT_TITLE.test(title)) continue;

    const mime = String(info.mime ?? "");
    if (!USABLE_MIME.test(mime)) continue;

    const meta = (info.extmetadata ?? {}) as Record<string, { value?: string }>;
    const license = meta.License?.value ?? "";
    const licenseName = meta.LicenseShortName?.value ?? "";
    if (!PD_LICENSE.test(license) && !PD_LICENSE_NAME.test(licenseName)) continue;

    const width = Number(info.width ?? 0);
    const height = Number(info.height ?? 0);
    if (width < 240 || height < 240) continue;
    // Skip panoramas / full-page scans — never a usable head-and-shoulders.
    if (width / height > 2 || height / width > 2.6) continue;

    const imageUrl = String(info.url ?? "");
    if (!imageUrl) continue;
    candidates.push({ url: imageUrl, source: "commons", width, height, title });
  }

  // Pre-cropped first, then portrait-oriented, then largest — the
  // processing step still has the final say, this just puts the likeliest
  // ones at the front of the MAX_CANDIDATES cut.
  const rank = (c: Candidate) =>
    (PRECROPPED_TITLE.test(c.title) ? 0 : 2) + (c.height >= c.width ? 0 : 1);
  candidates.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return b.width * b.height - a.width * a.height;
  });
  return candidates;
}

async function downloadImage(imageUrl: string, slug: string, index: number): Promise<string> {
  const res = await fetchWithRetry(imageUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Image download HTTP ${res.status}`);
  let ext = path.extname(new URL(imageUrl).pathname).toLowerCase();
  if (!/^\.(jpe?g|png|tiff?)$/.test(ext)) ext = ".jpg";
  const dest = path.join(SOURCE_DIR, `${slug}__${String(index).padStart(2, "0")}${ext}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

/** Everything staged for this author from a previous run — start each fetch clean. */
function clearStaged(slug: string): void {
  for (const dir of [SOURCE_DIR, STAGING_DIR]) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (file === slug || file.startsWith(`${slug}.`) || file.startsWith(`${slug}__`)) {
        rmSync(path.join(dir, file), { force: true });
      }
    }
  }
}

/**
 * Only fills birth_year/death_year/portrait_source_url, and only where
 * currently null — never touches `bio` (that's authors.bio, rendered as
 * author_note, hand-written per seed/README.md's curation conventions) or
 * any other editorial field. Purely factual, source-tagged data in, same
 * as source_tier/rights_status on the text side.
 */
async function upsertAuthorFacts(
  name: string,
  facts: { birthYear: number | null; deathYear: number | null; portraitSourceUrl: string | null }
) {
  await sql`
    insert into authors (name, birth_year, death_year, portrait_source_url)
    values (${name}, ${facts.birthYear}, ${facts.deathYear}, ${facts.portraitSourceUrl})
    on conflict (name) do update set
      birth_year = coalesce(authors.birth_year, excluded.birth_year),
      death_year = coalesce(authors.death_year, excluded.death_year),
      portrait_source_url = coalesce(authors.portrait_source_url, excluded.portrait_source_url)
  `;
}

async function fetchOne(name: string) {
  const slug = authorSlug(name);
  try {
    const summary = await fetchSummary(name);
    const { birthYear, deathYear } = parseLifespan(summary?.description ?? "");

    const candidates: Candidate[] = [];
    const wikipediaImage = summary?.originalimage?.source ?? summary?.thumbnail?.source ?? null;
    if (wikipediaImage) {
      candidates.push({ url: wikipediaImage, source: "wikipedia", width: 0, height: 0, title: "" });
    }

    try {
      candidates.push(...(await fetchCommonsCandidates(name)));
    } catch (err) {
      console.error(`  · Commons search failed for ${name}:`, err instanceof Error ? err.message : err);
    }

    // De-dupe by URL, keep original order (Wikipedia's own pick first).
    const seen = new Set<string>();
    const unique = candidates.filter((c) => !seen.has(c.url) && seen.add(c.url)).slice(0, MAX_CANDIDATES);

    clearStaged(slug);
    mkdirSync(SOURCE_DIR, { recursive: true });

    const saved: string[] = [];
    for (const [i, candidate] of unique.entries()) {
      try {
        saved.push(await downloadImage(candidate.url, slug, i + 1));
      } catch (err) {
        console.error(`  · download failed (${candidate.source}) for ${name}:`, err instanceof Error ? err.message : err);
      }
    }

    await upsertAuthorFacts(name, {
      birthYear,
      deathYear,
      portraitSourceUrl: unique[0]?.url ?? null,
    });

    console.log(`  ${saved.length > 0 ? "✓" : "✗"} ${name}`);
    console.log(`      lifespan: ${birthYear ?? "?"}–${deathYear ?? "?"}`);
    if (saved.length > 0) {
      console.log(`      ${saved.length} candidate(s): ${saved.map((p) => path.basename(p)).join(", ")}`);
    } else {
      console.log(`      no usable candidate images found (Wikipedia + Commons)`);
    }
    if (summary?.extract) {
      console.log(`      wikipedia extract (for hand-writing bio, not auto-applied):\n        ${summary.extract}`);
    }
  } catch (err) {
    console.error(`  ✗ ${name}:`, err instanceof Error ? err.message : err);
  }
}

/**
 * The real portrait backlog: authors with no *published* portrait
 * (portrait_url null), whatever happened on earlier runs. Re-fetching from
 * Wikipedia + Commons is a couple of cheap API calls with no model in the
 * loop, so there's no reason to skip an author just because a previous
 * attempt downloaded something that didn't threshold cleanly — the
 * per-run author cap in content-pipeline.yml is what bounds the cost.
 */
async function authorsMissingPortrait(): Promise<string[]> {
  const rows = await sql`
    select name from authors where portrait_url is null order by name
  `;
  return rows.map((r) => r.name as string);
}

async function main() {
  const args = process.argv.slice(2);
  const names = args.includes("--all") ? await authorsMissingPortrait() : args.filter((a) => !a.startsWith("--"));

  if (names.length === 0) {
    console.log("Usage:");
    console.log('  npm run fetch-author-portrait -- "Edgar Allan Poe" "Kate Chopin"');
    console.log("  npm run fetch-author-portrait -- --all   # every author with no published portrait_url");
    process.exitCode = 1;
    return;
  }

  console.log(`Fetching Wikipedia + Commons portrait candidates for ${names.length} author(s)…\n`);
  for (const [i, name] of names.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 300)); // stay polite to Wikimedia's API
    await fetchOne(name);
  }

  console.log(
    `\nRaw candidate images are staged in public/authors/_source/ as <slug>__NN.<ext>. Next: ` +
      `\`npm run process-author-portraits\` crops + thresholds each one and writes the best-scoring result to ` +
      `public/authors/_staging/<slug>.png (all candidates are kept as <slug>__NN.png to compare). Glance over it, ` +
      `then \`npm run publish-author-portrait -- "Name"\` (add \`--variant=N\` to publish a specific candidate) to ` +
      `upload to R2 and set authors.portrait_url. Verify the source image's own license is public domain / CC0 ` +
      `before publishing.`
  );
}

main();
