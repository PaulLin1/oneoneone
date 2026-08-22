import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { authorSlug } from "@/lib/authorPortraits";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}

const sql = neon(url);

const STAGING_DIR = path.join(process.cwd(), "public", "authors", "_source");

type WikipediaSummary = {
  extract?: string;
  description?: string;
  originalimage?: { source: string };
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
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

async function fetchSummaryFor(title: string): Promise<Response> {
  return fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    { headers: { "User-Agent": USER_AGENT } }
  );
}

/**
 * Catalog author names sometimes carry a curator-added disambiguator, e.g.
 * "Saki (H. H. Munro)" — Wikipedia's actual article title is just "Saki".
 * On a 404, retry once with the parenthetical stripped before giving up.
 */
async function fetchSummary(name: string): Promise<WikipediaSummary> {
  let res = await fetchSummaryFor(name);
  if (res.status === 404) {
    const stripped = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (stripped !== name) res = await fetchSummaryFor(stripped);
  }
  if (!res.ok) throw new Error(`Wikipedia summary API HTTP ${res.status}`);
  return res.json();
}

async function downloadImage(imageUrl: string, slug: string): Promise<string> {
  const res = await fetch(imageUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Image download HTTP ${res.status}`);
  const ext = path.extname(new URL(imageUrl).pathname) || ".jpg";
  const dest = path.join(STAGING_DIR, `${slug}${ext}`);
  mkdirSync(STAGING_DIR, { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
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
  try {
    const summary = await fetchSummary(name);
    const { birthYear, deathYear } = parseLifespan(summary.description ?? "");
    const imageUrl = summary.originalimage?.source ?? summary.thumbnail?.source ?? null;
    const slug = authorSlug(name);

    let savedTo: string | null = null;
    if (imageUrl) {
      try {
        savedTo = await downloadImage(imageUrl, slug);
      } catch (err) {
        console.error(`  ✗ image download failed for ${name}:`, err instanceof Error ? err.message : err);
      }
    }

    await upsertAuthorFacts(name, {
      birthYear,
      deathYear,
      portraitSourceUrl: imageUrl,
    });

    console.log(`  ✓ ${name}`);
    console.log(`      lifespan: ${birthYear ?? "?"}–${deathYear ?? "?"}`);
    console.log(`      portrait: ${savedTo ? `saved to ${path.relative(process.cwd(), savedTo)}` : "(none found)"}`);
    if (summary.extract) console.log(`      wikipedia extract (for hand-writing bio, not auto-applied):\n        ${summary.extract}`);
  } catch (err) {
    console.error(`  ✗ ${name}:`, err instanceof Error ? err.message : err);
  }
}

/** Authors with no bio yet — the field this script deliberately never fills. */
async function authorsMissingPortrait(): Promise<string[]> {
  const rows = await sql`
    select name from authors where portrait_source_url is null order by name
  `;
  return rows.map((r) => r.name as string);
}

async function main() {
  const args = process.argv.slice(2);
  const names = args.includes("--all") ? await authorsMissingPortrait() : args;

  if (names.length === 0) {
    console.log("Usage:");
    console.log('  npm run fetch-author-portrait -- "Edgar Allan Poe" "Kate Chopin"');
    console.log("  npm run fetch-author-portrait -- --all   # every author missing a portrait_source_url");
    process.exitCode = 1;
    return;
  }

  console.log(`Fetching Wikipedia summary + portrait for ${names.length} author(s)…\n`);
  for (const [i, name] of names.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 300)); // stay polite to Wikimedia's API
    await fetchOne(name);
  }

  console.log(
    `\nDownloaded images are raw, unprocessed Wikipedia source images staged in public/authors/_source/ ` +
      `— never wired up automatically. To actually add a portrait: crop it, convert to the flat black-and-white ` +
      `treatment (see the comment atop lib/authorPortraits.ts), save it as public/authors/<slug>.png, and add ` +
      `the author's name to AUTHORS_WITH_PORTRAIT in lib/authorPortraits.ts. Verify the source image's own ` +
      `license/PD status before using it — Wikipedia/Commons images aren't automatically public domain just ` +
      `because the author's writing is.`
  );
}

main();
