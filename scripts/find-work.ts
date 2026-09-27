/**
 * Adds ONE new public-domain work for one day, with its author portrait.
 *
 *   npm run find-work -- --category=poem|essay|story [--date=YYYY-MM-DD]
 *                        [--tries=60] [--parallel=3] [--dry-run]
 *
 * --date defaults to the category's first unfilled day from today on. A day
 * that already has a work is left alone (exit 0, nothing spent). To keep every
 * category filled ahead, run scripts/stock.ts instead of this directly.
 *
 * What it does, in order (each step is one function below):
 *   1. discover     — a shuffled queue of candidates, fetched once per run
 *                     (PoetryDB for poems; Wikisource categories and essay
 *                     collections for essays and stories, cached for a day in
 *                     .cache/). Already-saved and oversized pages are dropped
 *                     before any text is downloaded.
 *   2. fetchText    — get the clean full text. For Wikisource the page header
 *                     is read first, so index pages, tables of contents and
 *                     recently used authors are skipped before the text is fetched.
 *   3. textChecks   — length and clean-text rules, which need only the text
 *   4. lookupFacts  — Wikidata: publication year, author dates, author
 *                     photos, how well-known the author and work are
 *   5. factChecks   — public domain, notability, photos
 *      (a failed hard check at 3 or 5 means try the next candidate)
 *   6. makePortrait — download the author's photos, crop to the face, turn
 *                     into the black-and-white stencil the site draws
 *   7. aiReview     — ONE Claude call: rate literary quality 1-5 (a score of 1-2
 *                     means try the next candidate), write the description, and
 *                     count opening paragraphs that aren't the work (cut before saving).
 *                     Needs ANTHROPIC_API_KEY; costs a couple of cents.
 *   8. save         — portrait → public/authors/<author>.png,
 *                     work → data/works/<category>/<date>.json (lib/works.ts)
 *
 * Steps 2-6 run for --parallel candidates at once; Claude calls run one at a
 * time and stop as soon as one candidate passes, so a run never pays for more
 * than one successful review, and never makes more than MAX_AI_CALLS.
 *
 * An author is never scheduled within AUTHOR_GAP_DAYS of another of their
 * works (any category, before or after), and a work is never added twice.
 *
 * --dry-run does everything except step 8. The finished work is also printed
 * as JSON on stdout; the log goes to stderr, one block per candidate.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { daysBetween, todayIso } from "@/lib/dateMath";
import { processPortraitScored } from "@/lib/portraitProcessing";
import type { WorkCategory } from "@/lib/types";
import { loadAllWorks, scheduledDates, workPath, type ScheduledWork } from "@/lib/works";

const USER_AGENT = "oneoneone-find-work/1.0 (https://readoneoneone.com)";
const AI_MODEL = "claude-opus-5";

const PORTRAIT_DIR = "public/authors";
/** Candidate lists are cached here for CANDIDATE_CACHE_HOURS — listing essay collections takes ~70 requests. */
const CACHE_DIR = ".cache/find-work";
const CANDIDATE_CACHE_HOURS = 24;

const LENGTH_LIMITS: Record<WorkCategory, [number, number]> = {
  poem: [50, 1500],
  story: [800, 9000],
  essay: [500, 9000],
};
/** Poems are pre-filtered by line count so long epics aren't fetched only to fail the length check. */
const MAX_POEM_LINES = 120;
/** How many random poems to ask PoetryDB for each time the queue runs dry. */
const POEM_BATCH = 50;
/**
 * Where essays and stories come from on Wikisource: pages directly in
 * `categories`, plus every subpage of each book in `collectionCategories` and
 * `collections` (a collection's own page is its table of contents; the pieces
 * are its subpages, e.g. "Tremendous Trifles/A Piece of Chalk").
 */
const WIKISOURCE_SOURCES: Record<
  Exclude<WorkCategory, "poem">,
  { categories: string[]; collectionCategories: string[]; collections: string[] }
> = {
  story: {
    categories: ["Category:Short stories"],
    collectionCategories: ["Category:Collections of short stories"],
    collections: [],
  },
  essay: {
    categories: ["Category:Essays", "Category:Essays in periodicals", "Category:French essays"],
    collectionCategories: ["Category:Collections of essays"],
    // Classic collections Wikisource doesn't file under the categories above.
    collections: [
      "The Essays of Francis Bacon",
      "The Essays of Montaigne",
      "Essays: Second Series",
      "Tremendous Trifles",
      "Heretics",
      "A Miscellany of Men",
      "Alarms and Discursions",
      "The Defendant",
      "Familiar Studies of Men and Books",
      "The Rambler",
      "The Idler",
      "Mornings in Florence",
    ],
  },
};
/**
 * Wikisource pages with more wikitext than this can't be under 9000 words, so
 * they're dropped from the queue unfetched. There's no useful lower bound:
 * pages that transclude their text from scans are a few hundred bytes however
 * long the work is.
 */
const MAX_WIKITEXT_BYTES = 80_000;
const MIN_AUTHOR_SITELINKS = 10;
/** Wikimedia projects whose sitelinks end in "wiki" but aren't a Wikipedia. */
const NON_WIKIPEDIA_SITES = new Set(["commonswiki", "specieswiki", "metawiki", "mediawikiwiki", "wikidatawiki", "sourceswiki"]);
/** An author is never scheduled within this many days of another of their works, in any category. */
const AUTHOR_GAP_DAYS = 14;
/** Same bar the old portrait pipeline used — below it the stencil doesn't read as a face. */
const MIN_PORTRAIT_SCORE = 0.35;
const MIN_AI_QUALITY = 3;
/** Hard cap on Claude calls per run, so one run can never cost more than a few cents. */
const MAX_AI_CALLS = 4;

const REQUEST_TIMEOUT_MS = 30_000;
/** Retries for rate limits (429), server errors and dropped connections. */
const REQUEST_RETRIES = 3;

type Candidate = {
  title: string;
  author: string;
  /** Wikidata item of the author, when the source links one. */
  authorQid: string | null;
  sourceName: string;
  sourceUrl: string;
  text: string;
  year: number | null;
  /** Wikidata item of the work itself, when the source links one. */
  workQid: string | null;
  /** The source's own page name, e.g. "The Rambler/No. 45" — context for the title Claude writes. */
  sourcePage: string | null;
};

type Facts = {
  year: number | null;
  /** The author's English Wikipedia title, e.g. "Jerome K. Jerome" for "Jerome Klapka Jerome". */
  authorName: string | null;
  authorDeathYear: number | null;
  authorDescription: string | null;
  authorSitelinks: number;
  authorHasEnwiki: boolean;
  /** Every photo of the author found, best guess first. */
  photoUrls: string[];
  workIsNotable: boolean;
};

type Check = { name: string; hard: boolean; pass: boolean; detail: string };

const log = (msg: string) => console.error(msg);
const formatCheck = (ch: Check) => `  ${ch.pass ? "✓" : ch.hard ? "✗" : "·"} ${ch.name}: ${ch.detail}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** fetch with a timeout, retrying rate limits, server errors and network failures with backoff. */
async function request(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (err) {
      if (attempt >= REQUEST_RETRIES) throw err;
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (res.ok) return res;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= REQUEST_RETRIES) throw new Error(`${res.status} from ${url}`);
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 1000 * 2 ** attempt);
  }
}

async function getJson<T>(url: string): Promise<T> {
  return (await (await request(url)).json()) as T;
}

/** Wraps fn so overlapping calls run one after another, in call order. */
function oneAtATime<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  let last: Promise<unknown> = Promise.resolve();
  return (...args) => {
    const run = last.then(() => fn(...args));
    last = run.catch(() => {});
    return run;
  };
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const wikisourceUrl = (pageTitle: string) =>
  `https://en.wikisource.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;

// ─── saved works ────────────────────────────────────────────────────────────

/** Everything already saved, and the day this run is filling. */
type Schedule = { works: ScheduledWork[]; date: string };

/** Why this title/author shouldn't be added on this day, or null if it's fine. */
function redundancy(schedule: Schedule, title: string, author: string | undefined): string | null {
  if (!author) return null;
  if (schedule.works.some((w) => slug(w.title) === slug(title) && slug(w.author) === slug(author))) {
    return "already saved";
  }
  const near = schedule.works.find(
    (w) => slug(w.author) === slug(author) && Math.abs(daysBetween(w.date, schedule.date)) < AUTHOR_GAP_DAYS
  );
  return near ? `${author} is already on ${near.date} (want ${AUTHOR_GAP_DAYS}+ days apart)` : null;
}

// ─── 1. discover ────────────────────────────────────────────────────────────

type Found = { title: string; author?: string; lines?: string[] };

type PageInfo = { title: string; length: number };

/** Every page a Wikisource page generator yields, with its wikitext size, following continuation. */
async function listPages(generator: Record<string, string>): Promise<PageInfo[]> {
  const pages: PageInfo[] = [];
  let cont: Record<string, string> | undefined = {};
  while (cont) {
    const data: { query?: { pages: PageInfo[] }; continue?: Record<string, string> } = await getJson(
      "https://en.wikisource.org/w/api.php?action=query&prop=info&format=json&formatversion=2&" +
        new URLSearchParams({ ...generator, ...cont })
    );
    pages.push(...(data.query?.pages ?? []));
    cont = data.continue;
  }
  return pages;
}

const listCategory = (category: string) =>
  listPages({ generator: "categorymembers", gcmnamespace: "0", gcmlimit: "max", gcmtitle: category });

const listSubpages = (collection: string) =>
  listPages({ generator: "allpages", gapnamespace: "0", gaplimit: "max", gapprefix: `${collection}/` });

/** fn over items with at most `limit` running at once — polite to Wikimedia, still quick. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Every candidate page for the category, from WIKISOURCE_SOURCES, cached for CANDIDATE_CACHE_HOURS. */
async function listWikisourceCandidates(category: Exclude<WorkCategory, "poem">): Promise<PageInfo[]> {
  const source = WIKISOURCE_SOURCES[category];
  // Keyed by the source list too, so editing WIKISOURCE_SOURCES never serves a stale list.
  const key = createHash("sha1").update(JSON.stringify(source)).digest("hex").slice(0, 10);
  const cacheFile = path.join(CACHE_DIR, `${category}-${key}.json`);
  if (existsSync(cacheFile) && Date.now() - statSync(cacheFile).mtimeMs < CANDIDATE_CACHE_HOURS * 3_600_000) {
    return JSON.parse(readFileSync(cacheFile, "utf8")) as PageInfo[];
  }

  const direct = (await mapLimit(source.categories, 4, listCategory)).flat();
  const books = [
    ...(await mapLimit(source.collectionCategories, 4, listCategory)).flat().map((p) => p.title),
    ...source.collections,
  ];
  const pieces = (await mapLimit([...new Set(books)], 4, listSubpages)).flat();
  const pages = [...new Map([...direct, ...pieces].map((p) => [p.title, { title: p.title, length: p.length }])).values()];

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(pages));
  return pages;
}

/**
 * A function that hands out the next untried candidate, or null when the
 * source has none left. Safe to call from several workers at once.
 */
function discover(category: WorkCategory, schedule: Schedule): () => Promise<Found | null> {
  if (category === "poem") {
    const seen = new Set<string>();
    let queue: Found[] = [];
    return oneAtATime(async () => {
      // PoetryDB has no "list everything" call, so refill from random batches;
      // a few empty refills in a row means it keeps returning what we've seen.
      for (let refill = 0; !queue.length && refill < 5; refill++) {
        const poems = await getJson<{ title: string; author: string; lines: string[]; linecount: string }[]>(
          `https://poetrydb.org/random/${POEM_BATCH}`
        );
        queue = poems.filter(
          (p) =>
            Number(p.linecount) <= MAX_POEM_LINES &&
            !/fragment/i.test(p.title) && // unfinished pieces — "Fragment: To Italy" is 30 words
            p.author.includes(" ") && // a bare surname ("Robinson") can't be matched to one person
            !seen.has(`${p.author}|${p.title}`) &&
            !redundancy(schedule, p.title, p.author)
        );
      }
      const poem = queue.pop() ?? null;
      if (poem) seen.add(`${poem.author}|${poem.title}`);
      return poem;
    });
  }

  // Every source is listed once, so every page is reachable and none is tried
  // twice in a run. The order rotates between books (one piece per book per
  // round) rather than a plain shuffle: Montaigne's 114 essays would otherwise
  // crowd the queue, and while he's on a nearby day every one of them is a
  // wasted try.
  let titles: string[] | null = null;
  return oneAtATime(async () => {
    if (!titles) {
      const saved = new Set(schedule.works.map((w) => w.source_url));
      const books = new Map<string, string[]>();
      for (const p of await listWikisourceCandidates(category)) {
        if (p.length > MAX_WIKITEXT_BYTES || saved.has(wikisourceUrl(p.title))) continue;
        const book = p.title.split("/")[0];
        books.set(book, [...(books.get(book) ?? []), p.title]);
      }
      const queues = shuffle([...books.values()].map(shuffle));
      titles = [];
      for (let round = 0; queues.some((q) => q.length > round); round++) {
        for (const q of queues) if (q[round]) titles.push(q[round]);
      }
      titles.reverse(); // popped from the end
    }
    const title = titles.pop();
    return title ? { title } : null;
  });
}

// ─── 2. fetchText ───────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** The `name = value` fields of a page's {{header}} template, values still in wikitext. */
function headerFields(wikitext: string): Record<string, string> {
  const start = wikitext.search(/\{\{\s*header/i);
  const fields: Record<string, string> = {};
  let depth = 0;
  let part = "";
  const parts: string[] = [];
  // Split on "|" only at the template's own level — not inside [[links|…]] or {{nested|…}}.
  for (let i = start + 2; i < wikitext.length; i++) {
    const two = wikitext.slice(i, i + 2);
    if (two === "}}" && depth === 0) break;
    if (two === "{{" || two === "[[" || two === "}}" || two === "]]") {
      depth += two[0] === "{" || two[0] === "[" ? 1 : -1;
      part += two;
      i++;
    } else if (wikitext[i] === "|" && depth === 0) {
      parts.push(part);
      part = "";
    } else {
      part += wikitext[i];
    }
  }
  parts.push(part);
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq > 0) fields[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
  }
  return fields;
}

/** A header value as plain text: links reduced to their label, bold/italic quotes removed. */
function plain(value: string | undefined): string | null {
  const text = (value ?? "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/'{2,}/g, "")
    .trim();
  return text || null;
}

const headerYear = (wikitext: string) => {
  const m = plain(headerFields(wikitext).year)?.match(/\d{3,4}/);
  return m ? Number(m[0]) : null;
};

/** Drops magazine-style opening lines: a repeated title, "BY …", "Author of …", short ALL-CAPS subtitles. */
function trimFrontMatter(text: string, title: string): string {
  const lines = text.split("\n");
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  while (lines.length > 1) {
    const line = lines[0].trim();
    const isFrontMatter =
      line === "" ||
      (line.length < 120 &&
        (norm(line) === norm(title) || /^by\s/i.test(line) || /^author of\b/i.test(line) || line === line.toUpperCase()));
    if (!isFrontMatter) break;
    lines.shift();
  }
  return lines.join("\n").trim();
}

/** The author's Wikidata item via their Wikisource "Author:" page — reliable, unlike a name search. */
async function wikisourceAuthorQid(name: string): Promise<string | null> {
  const data = await getJson<{ query: { pages: { pageprops?: { wikibase_item?: string } }[] } }>(
    "https://en.wikisource.org/w/api.php?action=query&prop=pageprops&redirects=1&format=json&formatversion=2" +
      `&titles=${encodeURIComponent(`Author:${name}`)}`
  );
  return data.query.pages[0]?.pageprops?.wikibase_item ?? null;
}

const WIKISOURCE_PARSE = "https://en.wikisource.org/w/api.php?action=parse&redirects=1&format=json&formatversion=2";

/** The full clean text plus source details, or a reason to skip this candidate. */
async function fetchText(category: WorkCategory, found: Found, schedule: Schedule): Promise<Candidate | string> {
  if (category === "poem") {
    return {
      title: found.title,
      author: found.author!,
      authorQid: null,
      sourceName: "PoetryDB",
      sourceUrl: `https://poetrydb.org/title/${encodeURIComponent(found.title)}:abs`,
      // PoetryDB marks italics as _word_ — drop the markers.
      text: found.lines!.join("\n").replace(/_([^_\n]+)_/g, "$1").trim(),
      year: null,
      workQid: null,
      sourcePage: null,
    };
  }

  // The wikitext alone is enough to reject most pages, so the rendered HTML
  // (much bigger for transcluded texts) is only fetched for pages that survive.
  const meta = await getJson<{ parse: { title: string; wikitext: string; properties: { wikibase_item?: string } } }>(
    `${WIKISOURCE_PARSE}&prop=wikitext|properties&page=${encodeURIComponent(found.title)}`
  );
  const { title, wikitext, properties } = meta.parse;

  if (!/\{\{\s*header/i.test(wikitext)) return "not a single work (versions / index page)";
  if (/\{\{\s*(?:AuxTOC|TOC begin)/i.test(wikitext)) return "table of contents, not the text";

  const header = headerFields(wikitext);
  const author = plain(header.author);
  if (!author) return "no author in the page header";
  // A piece inside a collection has the collection as its header title and
  // the piece itself as "section"; a standalone page's header title is the
  // work's. The page name is the fallback, minus a disambiguator like "(Petty 1647)".
  const pieceTitle =
    plain(header.section) ??
    (title.includes("/") ? null : plain(header.title)) ??
    title.split("/").pop()!.replace(/\s*\([^)]*\)$/, "");
  const skip = redundancy(schedule, pieceTitle, author);
  if (skip) return skip;

  const [page, authorQid, parentYear] = await Promise.all([
    getJson<{ parse: { text: string } }>(`${WIKISOURCE_PARSE}&prop=text&page=${encodeURIComponent(title)}`),
    wikisourceAuthorQid(author),
    // Pieces inside a collection often leave the year to the collection's own page.
    headerYear(wikitext) === null && title.includes("/")
      ? getJson<{ parse: { wikitext: string } }>(
          `${WIKISOURCE_PARSE}&prop=wikitext&page=${encodeURIComponent(title.split("/")[0])}`
        )
          .then((parent) => headerYear(parent.parse.wikitext))
          .catch(() => null)
      : null,
  ]);
  const notes = plain(header.notes);

  const paragraphs = [...page.parse.text.replace(/<style[\s\S]*?<\/style>/g, "").matchAll(/<p>([\s\S]*?)<\/p>/g)]
    .map((m) =>
      decodeEntities(
        m[1]
          .replace(/<br\s*\/?>/g, "\n")
          .replace(/<sup[\s\S]*?<\/sup>/g, "") // footnote markers
          .replace(/<[^>]+>/g, "")
      )
        .replace(/[ \t]+/g, " ")
        .replace(/ *\n */g, "\n")
        .trim()
    )
    .filter(Boolean)
    // The header's notes and the license box also render as <p>s.
    .filter((p) => !(notes && p.startsWith(notes.slice(0, 40))))
    .filter((p) => !/public domain|Public domainPublic domain/i.test(p) || p.length > 400)
    // A leading ALL-CAPS repeat of the title.
    .filter((p, i) => !(i === 0 && p === p.toUpperCase() && p.length < 120));

  return {
    title: pieceTitle,
    author,
    authorQid,
    sourceName: "Wikisource",
    sourceUrl: wikisourceUrl(title),
    text: trimFrontMatter(paragraphs.join("\n\n"), pieceTitle),
    year: headerYear(wikitext) ?? parentYear,
    workQid: properties.wikibase_item ?? null,
    sourcePage: title,
  };
}

// ─── 3. textChecks ──────────────────────────────────────────────────────────

/** Rules that need only the text — run before any Wikidata lookups. */
function textChecks(category: WorkCategory, c: Candidate): Check[] {
  const words = wordCount(c.text);
  const [minWords, maxWords] = LENGTH_LIMITS[category];

  const nonSpace = c.text.replace(/\s/g, "");
  const letterRatio = nonSpace.length ? (nonSpace.match(/\p{L}/gu)?.length ?? 0) / nonSpace.length : 0;
  const artifacts = [
    [/<|[{}]|\[\[/, "leftover markup"],
    [/\[Pg|\[page/i, "page-number markers"],
    [/\|{2,}/, "table debris"],
    [/\w- \w/, "broken hyphenation"],
  ].filter(([re]) => (re as RegExp).test(c.text)).map(([, label]) => label as string);
  const paragraphs = c.text.split("\n\n");
  const shortParagraphShare = paragraphs.filter((p) => p.length < 40).length / paragraphs.length;
  const proseLooksLikeProse = category === "poem" || shortParagraphShare < 0.3;

  return [
    {
      name: "length",
      hard: true,
      pass: words >= minWords && words <= maxWords,
      detail: `${words} words (want ${minWords}–${maxWords})`,
    },
    {
      name: "clean text",
      hard: true,
      pass: artifacts.length === 0 && letterRatio >= 0.7 && proseLooksLikeProse,
      detail:
        [
          ...artifacts,
          letterRatio < 0.7 ? `only ${Math.round(letterRatio * 100)}% letters` : "",
          proseLooksLikeProse ? "" : `${Math.round(shortParagraphShare * 100)}% of paragraphs are fragments`,
        ]
          .filter(Boolean)
          .join(", ") || "ok",
    },
  ];
}

// ─── 4. lookupFacts ─────────────────────────────────────────────────────────

type Entity = {
  id: string;
  descriptions?: { en?: { value: string } };
  sitelinks?: Record<string, { title: string }>;
  claims?: Record<string, { mainsnak: { datavalue?: { value: unknown } } }[]>;
};

/**
 * Several Wikidata items in one request, trimmed to what's used here —
 * Special:EntityData would send every label in every language, often megabytes
 * for a famous author.
 */
async function entities(qids: string[]): Promise<Entity[]> {
  if (!qids.length) return [];
  const data = await getJson<{ entities: Record<string, Entity & { missing?: string }> }>(
    "https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims|sitelinks|descriptions&languages=en&format=json" +
      `&ids=${qids.map(encodeURIComponent).join("|")}`
  );
  return qids.map((id) => data.entities[id]).filter((e) => e && e.missing === undefined);
}

const entity = async (qid: string): Promise<Entity | null> => (await entities([qid]))[0] ?? null;

function claimValues(e: Entity, prop: string): unknown[] {
  return (e.claims?.[prop] ?? []).map((c) => c.mainsnak.datavalue?.value).filter((v) => v !== undefined);
}

function claimYear(e: Entity, prop: string): number | null {
  const [v] = claimValues(e, prop) as { time: string }[];
  const m = v?.time.match(/^[+-](\d+)-/);
  return m ? Number(m[1]) : null;
}

async function searchWikidata(q: string): Promise<Entity[]> {
  const data = await getJson<{ search: { id: string }[] }>(
    "https://www.wikidata.org/w/api.php?action=wbsearchentities&language=en&type=item&limit=5&format=json" +
      `&search=${encodeURIComponent(q)}`
  );
  return entities(data.search.map((hit) => hit.id));
}

/** Wikidata occupations (P106) that make a name-search hit plausibly the author. */
const LITERARY_OCCUPATIONS = new Set([
  "Q36180", // writer
  "Q49757", // poet
  "Q6625963", // novelist
  "Q11774202", // essayist
  "Q214917", // playwright
  "Q482980", // author
  "Q15949613", // short story writer
  "Q4263842", // literary critic
  "Q1930187", // journalist
  "Q822146", // lyricist
  "Q4853732", // children's writer
  "Q333634", // translator
  "Q4964182", // philosopher
  "Q201788", // historian
  "Q1234713", // theologian
  "Q18844224", // science fiction writer
  "Q28389", // screenwriter
]);

/** The Wikidata item for a person by name, trying "Last, First" style variants too. */
async function findAuthorQid(name: string): Promise<string | null> {
  const variants = [name, name.split(",")[0], name.replace(/^.*,\s*/, "")];
  for (const q of new Set(variants)) {
    const match = (await searchWikidata(q)).find((e) => {
      const isHuman = (claimValues(e, "P31") as { id: string }[]).some((v) => v.id === "Q5");
      // Guards against a present-day namesake: a public-domain author was born long ago.
      const born = claimYear(e, "P569");
      // Guards against a namesake in another field: "Samuel Coleridge" also
      // finds Samuel Coleridge-Taylor, a composer.
      const isWriter = (claimValues(e, "P106") as { id: string }[]).some((v) => LITERARY_OCCUPATIONS.has(v.id));
      return isHuman && isWriter && born !== null && born <= new Date().getFullYear() - 110;
    });
    if (match) return match.id;
  }
  return null;
}

/** The work's own Wikidata item, found by title — only accepted if its author (P50) matches. */
async function findWorkByTitle(title: string, authorQid: string): Promise<Entity | null> {
  const hits = await searchWikidata(title);
  return hits.find((e) => (claimValues(e, "P50") as { id: string }[]).some((v) => v.id === authorQid)) ?? null;
}

/** "Byron_1813_by_Phillips.jpg" from either a Special:FilePath URL or an upload.wikimedia.org URL. */
const photoFileName = (url: string) => decodeURIComponent(new URL(url).pathname.split("/").pop()!).replace(/ /g, "_");

async function wikipediaImage(title: string): Promise<string | null> {
  try {
    const summary = await getJson<{ originalimage?: { source: string } }>(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    );
    return summary.originalimage?.source ?? null;
  } catch {
    return null;
  }
}

/** Publication year, author dates and photos, and how well-known the author and work are. */
async function lookupFacts(c: Candidate): Promise<Facts> {
  let work = c.workQid ? await entity(c.workQid) : null;
  const authorFromWork = work ? (claimValues(work, "P50") as { id: string }[])[0]?.id : undefined;
  const authorQid = authorFromWork ?? c.authorQid ?? (await findAuthorQid(c.author));
  const [author, workByTitle] = await Promise.all([
    authorQid ? entity(authorQid) : null,
    !work && authorQid ? findWorkByTitle(c.title, authorQid) : null,
  ]);
  work ??= workByTitle;

  const enwikiAuthor = author?.sitelinks?.enwiki?.title ?? null;
  const commonsPhotos = (author ? (claimValues(author, "P18") as string[]) : []).map(
    (file) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, "_"))}?width=1200`
  );
  const wikipediaPhoto = enwikiAuthor ? await wikipediaImage(enwikiAuthor) : null;

  return {
    year: (work && claimYear(work, "P577")) ?? c.year,
    authorName: enwikiAuthor?.replace(/\s*\([^)]*\)$/, "") ?? null,
    authorDeathYear: author ? claimYear(author, "P570") : null,
    authorDescription: author?.descriptions?.en?.value ?? null,
    authorSitelinks: Object.keys(author?.sitelinks ?? {}).filter((k) => k.endsWith("wiki") && !NON_WIKIPEDIA_SITES.has(k))
      .length,
    authorHasEnwiki: Boolean(enwikiAuthor),
    // Wikipedia's lead image is often the same file as a Commons one — keep one copy per file name.
    photoUrls: [...commonsPhotos, ...(wikipediaPhoto ? [wikipediaPhoto] : [])].filter(
      (url, i, all) => all.findIndex((u) => photoFileName(u) === photoFileName(url)) === i
    ),
    workIsNotable: Boolean(work),
  };
}

// ─── 5. factChecks ──────────────────────────────────────────────────────────

/** Rules that need the Wikidata facts. Any failed `hard` check rejects the candidate. */
function factChecks(f: Facts): Check[] {
  const thisYear = new Date().getFullYear();
  const pdByYear = f.year !== null && f.year <= thisYear - 96;
  const pdByDeath = f.authorDeathYear !== null && thisYear - f.authorDeathYear >= 70;

  return [
    {
      name: "public domain",
      hard: true,
      pass: pdByYear || pdByDeath,
      detail: pdByYear
        ? `published ${f.year}`
        : pdByDeath
          ? `author died ${f.authorDeathYear}`
          : `can't confirm (year ${f.year ?? "?"}, author died ${f.authorDeathYear ?? "?"})`,
    },
    {
      name: "notable author",
      hard: true,
      pass: f.authorHasEnwiki && f.authorSitelinks >= MIN_AUTHOR_SITELINKS,
      detail: `${f.authorSitelinks} Wikipedia editions${f.authorHasEnwiki ? "" : ", no English article"} (want ≥ ${MIN_AUTHOR_SITELINKS})`,
    },
    {
      name: "author photos",
      hard: true,
      pass: f.photoUrls.length > 0,
      detail: f.photoUrls.length ? `${f.photoUrls.length} found` : "none on Wikidata or Wikipedia",
    },
    {
      name: "notable work",
      hard: false,
      pass: f.workIsNotable,
      detail: f.workIsNotable ? "has its own Wikidata entry" : "no Wikidata entry of its own",
    },
  ];
}

// ─── 6. makePortrait ────────────────────────────────────────────────────────

const portraitPath = (author: string) => path.join(PORTRAIT_DIR, `${slug(author)}.png`);

/**
 * The stencil PNG for this author: reuses one already saved, otherwise
 * processes every photo and keeps the best one that has a face and clears
 * MIN_PORTRAIT_SCORE. `png` is null when an existing file is reused.
 */
async function makePortrait(author: string, photoUrls: string[]): Promise<{ png: Buffer | null; check: Check }> {
  if (existsSync(portraitPath(author))) {
    return { png: null, check: { name: "portrait", hard: true, pass: true, detail: `reusing ${portraitPath(author)}` } };
  }

  const results = await Promise.all(
    photoUrls.map(async (url) => {
      try {
        const res = await request(url);
        return await processPortraitScored(Buffer.from(await res.arrayBuffer()));
      } catch (err) {
        return `download failed (${err instanceof Error ? err.message : err})`;
      }
    })
  );

  let best: { png: Buffer; score: number } | null = null;
  for (const r of results) {
    if (typeof r === "string") continue;
    if (r.faceFound && r.score >= MIN_PORTRAIT_SCORE && r.score > (best?.score ?? -1)) best = r;
  }
  const notes = results.map((r) =>
    typeof r === "string" ? r : `${r.score.toFixed(2)}${r.faceFound ? "" : " (no face)"}`
  );

  return {
    png: best?.png ?? null,
    check: {
      name: "portrait",
      hard: true,
      pass: best !== null,
      detail: `photo scores ${notes.join(", ")} (want a face and ≥ ${MIN_PORTRAIT_SCORE})`,
    },
  };
}

// ─── 7. aiReview ────────────────────────────────────────────────────────────

type AiVerdict = {
  /** The title as readers should see it — no chapter numbers or disambiguators. */
  title: string;
  /** Whether it reads as a complete piece on its own, not a chapter of a continuous book or a note. */
  standalone: boolean;
  /** False when the text is plainly by someone else — an editor's introduction or a biography of the author. */
  by_this_author: boolean;
  literary_quality: number;
  reason: string;
  description: string;
  /** Leading paragraphs that aren't the work itself: editor's notes, title pages, publisher lines. */
  front_matter_paragraphs: number;
};

/** Structured outputs guarantee the reply parses and has every field. */
const AI_VERDICT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    standalone: { type: "boolean" },
    by_this_author: { type: "boolean" },
    literary_quality: { type: "integer", enum: [1, 2, 3, 4, 5] },
    reason: { type: "string" },
    description: { type: "string" },
    front_matter_paragraphs: { type: "integer", enum: [0, 1, 2, 3, 4, 5] },
  },
  required: ["title", "standalone", "by_this_author", "literary_quality", "reason", "description", "front_matter_paragraphs"],
  additionalProperties: false,
};
/** Opening paragraphs shown numbered to Claude, so it can count the front matter. */
const NUMBERED_OPENING_PARAGRAPHS = 6;

/** AI_MODEL's list price in dollars per million tokens, for the end-of-run cost line. */
const AI_PRICE_PER_MTOK = { input: 5, output: 25 };
const aiSpend = { calls: 0, inputTokens: 0, outputTokens: 0 };
const aiCost = () =>
  (aiSpend.inputTokens * AI_PRICE_PER_MTOK.input + aiSpend.outputTokens * AI_PRICE_PER_MTOK.output) / 1e6;

/** Exactly one request. Null means "skip this candidate"; an API error (bad key, no credit) stops the run. */
async function aiReview(client: Anthropic, c: Candidate, category: WorkCategory, year: number | null): Promise<AiVerdict | null> {
  const excerpt = c.text.split(/\s+/).slice(0, 1500).join(" ");
  const opening = c.text
    .split("\n\n")
    .slice(0, NUMBERED_OPENING_PARAGRAPHS)
    .map((p, i) => `[${i + 1}] ${p.length > 200 ? `${p.slice(0, 200)}…` : p}`)
    .join("\n");
  const response = await client.beta.messages.create({
    model: AI_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: { type: "json_schema", schema: AI_VERDICT_SCHEMA } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [
      {
        role: "user",
        content:
          `You're choosing pieces for a daily reading site in the spirit of Ray Bradbury's "one poem, one essay, one story a night".\n\n` +
          `${category}: "${c.title}" by ${c.author}${year ? ` (${year})` : ""}` +
          `${c.sourcePage ? `\nSource page: ${c.sourcePage}` : ""}\n\n${excerpt}\n\n` +
          `Its opening paragraphs, numbered:\n${opening}\n\n` +
          `Give:\n` +
          `- title: the title readers should see. Use the piece's real title without chapter, section or ` +
          `essay numbering ("XI. The Necessity for a Majority" → "The Necessity for a Majority") or ` +
          `disambiguators like "(story)". If it has no title of its own, name it after its collection and number, ` +
          `e.g. "The Rambler, No. 45".\n` +
          `- standalone: true if it reads as a complete ${category} on its own; false for a chapter of a ` +
          `continuous book, a note or appendix, a fragment, or a whole book\n` +
          `- by_this_author: false if the text is plainly written by someone other than ${c.author} — ` +
          `an editor's or translator's introduction, a memoir or biography of them; otherwise true\n` +
          `- literary_quality: 1-5, 5 = a piece worth a reader's evening\n` +
          `- reason: one sentence\n` +
          `- description: one or two sentences for the front page that make someone want to read it, no spoilers\n` +
          `- front_matter_paragraphs: how many of the numbered opening paragraphs aren't part of the work itself ` +
          `(an editor's note, a title page, publisher or dedication lines, a repeated title or byline) and should be cut; ` +
          `0 if it starts with the work. An epigraph the author chose is part of the work.`,
      },
    ],
  });
  aiSpend.calls++;
  aiSpend.inputTokens += response.usage.input_tokens;
  aiSpend.outputTokens += response.usage.output_tokens;
  if (response.stop_reason === "refusal") return null;
  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  try {
    const verdict = JSON.parse(text) as AiVerdict;
    return verdict.description.trim() && verdict.title.trim() ? verdict : null;
  } catch {
    return null;
  }
}

// ─── 8. save ────────────────────────────────────────────────────────────────

function buildWork(category: WorkCategory, date: string, c: Candidate, f: Facts, description: string): ScheduledWork {
  return {
    date,
    id: slug(`${c.author} ${c.title}`),
    title: c.title,
    author: c.author,
    author_note: f.authorDescription,
    author_portrait_url: `/authors/${slug(c.author)}.png`,
    year: f.year,
    category,
    text_content: c.text,
    description: description.trim(),
    source_name: c.sourceName,
    source_url: c.sourceUrl,
    public_domain: true,
    reading_minutes: Math.max(1, Math.ceil(wordCount(c.text) / (category === "poem" ? 130 : 230))),
  };
}

/** Everything the site relies on, checked once more right before writing. */
function problemsWith(work: ScheduledWork): string[] {
  const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  return [
    !text(work.id) && "no id",
    !text(work.title) && "no title",
    !text(work.author) && "no author",
    !text(work.text_content) && "no text",
    !text(work.description) && "no description",
    !text(work.source_url) && "no source URL",
    !(work.reading_minutes >= 1) && "no reading time",
    !/^\d{4}-\d{2}-\d{2}$/.test(work.date) && "bad date",
  ].filter((p): p is string => Boolean(p));
}

/** Writes via a temp file and rename, so a crash never leaves a half-written file for the site to read. */
function writeAtomic(file: string, data: string | Buffer) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

function save(work: ScheduledWork, png: Buffer | null) {
  const problems = problemsWith(work);
  if (problems.length) throw new Error(`refusing to save: ${problems.join(", ")}`);
  const file = workPath(work.category, work.date);
  if (existsSync(file)) throw new Error(`refusing to save: ${file} already exists`);
  // Portrait first: a saved work always has its portrait, never the reverse.
  if (png) writeAtomic(portraitPath(work.author), png);
  writeAtomic(file, JSON.stringify(work, null, 2) + "\n");
}

// ─── run ────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? "true"];
    })
  );
  const category = args.category as WorkCategory;
  const tries = Number(args.tries ?? 60);
  const parallel = Number(args.parallel ?? 3);
  const date = args.date;
  const validDate = date === undefined || (/^\d{4}-\d{2}-\d{2}$/.test(date) && todayIso(new Date(`${date}T00:00:00Z`)) === date);
  if (!["poem", "essay", "story"].includes(category) || !(tries >= 1) || !(parallel >= 1) || !validDate) {
    log(
      "usage: npm run find-work -- --category=poem|essay|story [--date=YYYY-MM-DD] [--tries=60] [--parallel=3] [--dry-run]"
    );
    process.exit(1);
  }
  return { category, date, tries, parallel, dryRun: args["dry-run"] === "true" };
}

/** The first day from today on with no work for this category. */
function firstOpenDate(category: WorkCategory): string {
  const taken = new Set(scheduledDates(category));
  const day = new Date(`${todayIso()}T00:00:00Z`);
  while (taken.has(todayIso(day))) day.setUTCDate(day.getUTCDate() + 1);
  return todayIso(day);
}

type Winner = { work: ScheduledWork; checks: Check[]; png: Buffer | null };

async function main() {
  const args = parseArgs();
  const { category, tries, parallel, dryRun } = args;
  const date = args.date ?? firstOpenDate(category);
  if (existsSync(workPath(category, date))) {
    log(`${category} for ${date} is already saved — nothing to do.`);
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    log("ANTHROPIC_API_KEY isn't set — add it to .env.local (the description step needs it).");
    process.exit(1);
  }
  log(`Finding ${category === "essay" ? "an" : "a"} ${category} for ${date}`);
  const client = new Anthropic();
  const schedule: Schedule = { works: loadAllWorks(), date };
  const nextCandidate = discover(category, schedule);

  let attempts = 0;
  let winner: Winner | null = null;
  let fatal: string | null = null;
  let exhausted = false;
  const stopped = () => winner !== null || fatal !== null;

  // Claude calls go through here one at a time, and a passing verdict claims
  // the win before the next call starts — so once a candidate passes, no
  // other candidate is sent for review.
  const review = oneAtATime(async (candidate: Candidate, facts: Facts, checks: Check[], png: Buffer | null) => {
    if (stopped()) return null;
    if (aiSpend.calls >= MAX_AI_CALLS) {
      fatal = `stopped at the cap of ${MAX_AI_CALLS} Claude calls per run without a passing work`;
      return null;
    }
    const verdict = await aiReview(client, candidate, category, facts.year);
    const aiCheck: Check = verdict
      ? {
          name: "literary quality (ai)",
          hard: true,
          pass: verdict.literary_quality >= MIN_AI_QUALITY,
          detail: `${verdict.literary_quality}/5 — ${verdict.reason}`,
        }
      : { name: "literary quality (ai)", hard: true, pass: false, detail: "no usable answer" };
    if (!verdict || !aiCheck.pass) return [aiCheck];

    const title = verdict.title.trim();
    const pieceCheck: Check = {
      name: "standalone piece (ai)",
      hard: true,
      pass: verdict.standalone && verdict.by_this_author && !redundancy(schedule, title, candidate.author),
      detail: !verdict.standalone
        ? "not a complete piece on its own"
        : !verdict.by_this_author
          ? `not written by ${candidate.author}`
          : (redundancy(schedule, title, candidate.author) ?? `titled "${title}"`),
    };
    if (!pieceCheck.pass) return [aiCheck, pieceCheck];

    const cut = verdict.front_matter_paragraphs;
    const trimmed = { ...candidate, title, text: candidate.text.split("\n\n").slice(cut).join("\n\n") };
    const cutCheck: Check = {
      name: "front matter (ai)",
      hard: true,
      pass: textChecks(category, trimmed).every((ch) => ch.pass),
      detail: cut ? `cut ${cut} opening paragraph${cut === 1 ? "" : "s"}` : "none",
    };
    if (cutCheck.pass) {
      const work = buildWork(category, date, trimmed, facts, verdict.description);
      winner = { work, checks: [...checks, aiCheck, pieceCheck, cutCheck], png };
    }
    return [aiCheck, pieceCheck, cutCheck];
  });

  /** One candidate, start to finish. Returns its log lines so parallel candidates don't interleave. */
  async function tryOne(attempt: number, found: Found): Promise<string[]> {
    const out = [`\n[${attempt}/${tries}] ${found.title}${found.author ? ` — ${found.author}` : ""}`];
    try {
      const candidate = await fetchText(category, found, schedule);
      if (typeof candidate === "string") return [...out, `  skip: ${candidate}`];

      const checks = textChecks(category, candidate);
      out.push(...checks.map(formatCheck));
      if (checks.some((ch) => ch.hard && !ch.pass) || stopped()) return out;

      const facts = await lookupFacts(candidate);
      // Sources spell names differently; one name per author keeps the
      // recent-author rule and the portrait file working across sources.
      if (facts.authorName && facts.authorName !== candidate.author) {
        out.push(`  author: ${candidate.author} → ${facts.authorName}`);
        candidate.author = facts.authorName;
        const skip = redundancy(schedule, candidate.title, candidate.author);
        if (skip) return [...out, `  skip: ${skip}`];
      }
      const moreChecks = factChecks(facts);
      checks.push(...moreChecks);
      out.push(...moreChecks.map(formatCheck));
      if (moreChecks.some((ch) => ch.hard && !ch.pass) || stopped()) return out;

      const portrait = await makePortrait(candidate.author, facts.photoUrls);
      checks.push(portrait.check);
      out.push(formatCheck(portrait.check));
      if (!portrait.check.pass) return out;

      const aiChecks = await review(candidate, facts, checks, portrait.png);
      return [...out, ...(aiChecks ? aiChecks.map(formatCheck) : ["  (not reviewed: the run already stopped)"])];
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        fatal = `Claude API error ${err.status}: ${err.message}`;
        return out;
      }
      return [...out, `  error: ${err instanceof Error ? err.message : err}`];
    }
  }

  async function worker() {
    while (!stopped() && attempts < tries) {
      const attempt = ++attempts;
      const found = await nextCandidate().catch((err) => {
        fatal = `couldn't list candidates: ${err instanceof Error ? err.message : err}`;
        return null;
      });
      if (!found) {
        if (!fatal) exhausted = true;
        return;
      }
      (await tryOne(attempt, found)).forEach(log);
    }
  }

  await Promise.all(Array.from({ length: Math.min(parallel, tries) }, worker));
  log(
    `\n${attempts} candidates tried; Claude: ${aiSpend.calls} call${aiSpend.calls === 1 ? "" : "s"}, ` +
      `${aiSpend.inputTokens} in / ${aiSpend.outputTokens} out tokens ≈ $${aiCost().toFixed(3)}`
  );

  if (fatal) {
    log(`\n${fatal}`);
    process.exit(1);
  }
  const won = winner as Winner | null;
  if (won) {
    if (dryRun) {
      log("\n→ passed (dry run: nothing saved)");
    } else {
      save(won.work, won.png);
      log(`\n→ saved to ${workPath(category, date)}${won.png ? ` and ${portraitPath(won.work.author)}` : ""}`);
    }
    console.log(JSON.stringify({ work: won.work, checks: won.checks }, null, 2));
    return;
  }

  log(
    exhausted
      ? `\nNo untried candidates left in the source.`
      : `\nNothing passed in ${tries} tries — run again or raise --tries.`
  );
  process.exit(1);
}

main();
