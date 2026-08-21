# oneoneone

One poem. One essay. One story. The same three, for everyone, every day.

A shared daily reading ritual — like Wordle, not a personalized feed. The
day's three works are picked by a fixed, deterministic rotation (same date
in → same three out, for every reader, everywhere). No accounts, no tracking
— today's selection is cached in `localStorage` purely so a page refresh
doesn't re-fetch it; nothing about what you've read is recorded anywhere.

- **Theme** — when two or more of today's three share a tag, `selection.theme`
  carries it through to the Share text (`Thread: <tag>`). This is found,
  never engineered: each category is picked independently, and the theme is
  whatever overlap turns up afterward — forcing a connection would mean
  correlating the three rotations, which isn't how the daily picks work.
  There's no dedicated UI for it (a "today's thread" panel used to show it,
  plus related catalog works — removed; the product is deliberately just the
  three things, nothing more).
- **Share** — a Wordle-style `#oneoneonedayN` text block, copied or shared
  natively, on today's page or any archive day.
- **Archive** (`/archive`) — every past day is trivially reconstructable
  since selection is a pure function of date, so there's no archive table at
  all. A plain reverse-chronological list, newest first; click a day to
  expand a dropdown of its poem/essay/story, each linking straight into
  `/archive/[day]/[category]`. Future days 404 — same reason Wordle doesn't
  let you peek at tomorrow's answer.
- **Shuffle** — an opt-in, per-reader "give me something else" on the
  `/read/[category]` flow (`app/api/randomize/route.ts`), for anyone who
  doesn't want the identical shared pick. Fully outside the deterministic
  selection contract: it's local to your browser, never seeded, never
  persisted server-side, and Archive/Share always show the one canonical
  daily pick regardless of whether you shuffled.

No accounts, no comments, no in-app discussion — the site is deliberately
just the reading + the share hook; if people want to talk about a day, that
happens wherever they already are, via the hashtag.

## Stack

- Next.js (App Router, TypeScript) + Tailwind CSS 4
- Neon (Postgres) for the content catalog, via `@neondatabase/serverless`
- No auth — all user state is local to the browser

## Setup

1. Create a Neon project, then copy `.env.local.example` to `.env.local` and
   fill in your project's connection string (Neon dashboard → Connect):

   ```bash
   cp .env.local.example .env.local
   ```

2. Apply the schema (run migrations in order — `0001`, `0002`, `0003`),
   either via `psql` or by pasting each file into the Neon SQL editor:

   ```bash
   psql "$DATABASE_URL" -f db/migrations/0001_init.sql
   psql "$DATABASE_URL" -f db/migrations/0002_scalable_schema.sql
   psql "$DATABASE_URL" -f db/migrations/0003_curation_and_dedup.sql
   ```

   `0002` is what actually defines the current schema (normalized authors/
   tags, a publishing pipeline, a `works_feed` view) — `0001`'s `works` table
   only exists so `0002` has something to replace; a fresh Neon project can
   run both back to back with no issue. `0003` adds `pg_trgm`-based fuzzy
   dedup, a `rights_status` column (replacing a hardcoded `public_domain =
   true`), and source-trust tiering — see "Content pipeline" below.

3. Seed the content catalog from `seed/works.json`:

   ```bash
   npm run seed
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Project layout

- `app/` — pages: `/` (today's three), `/read/[category]` (reading view,
  with an opt-in Shuffle), `/work/[id]` (exploratory reads), `/archive`
  (list of every past day — click one to expand a dropdown of its three),
  `/archive/[day]/[category]` (same reading-flow chrome as `/read`, for an
  archived day), `/today` (redirects to `/`), `app/api/daily-selection` (GET
  route serving the day's puzzle), `app/api/randomize` (GET route backing
  Shuffle — outside the daily selection contract, see "Shuffle" above)
- `components/ReadingFlow.tsx` — the shared stepper chrome (back link,
  clickable progress boxes, reading view, next/done button) used by both
  `/read/[category]` and `/archive/[day]/[category]`, so a formatting change
  only has to happen in one place to reach both today's flow and every
  archived day.
- `lib/archive.ts` — walks Day 1 → today re-running the selection algorithm
  per day to build the archive list; no separate archive storage needed
- `lib/selection/algorithm.ts` — the daily-selection algorithm: a fixed
  per-category rotation seeded once (not per-day), indexed by day number, so
  every reader gets the same three and nothing repeats until the whole
  category has cycled through. Also computes the daily theme + related works.
  Untouched by Shuffle — that lives entirely in `app/api/randomize`.
- `lib/epoch.ts` — the shared day-numbering epoch (`Day 1` = launch date);
  this is what makes "Day 47" mean the same calendar day for everyone.
- `lib/local-state/useLocalState.ts` — caches today's selection in
  `localStorage` so a refresh doesn't re-fetch; also tracks any Shuffle
  overrides, kept as a separate key from the canonical selection so Archive
  and Share can never accidentally read a shuffled pick. That's the only
  client state in the app — selection itself is server-authoritative and
  identical for everyone, and nothing about what's been read is tracked.
- `lib/categoryColor.ts` — the poem/essay/story color mapping shared by
  every component that shows a category (cards, badges, progress dots)
- `lib/rights.ts` — computes `rights_status` (`public_domain` /
  `unverified`) from a publication year or author death year; used by the
  fetch/load pipeline so nothing gets marked public domain without the math
  actually clearing the U.S. 96-years-after-publication bar.
- `seed/works.json` — the hand-curated content catalog; see `seed/README.md`
  for curation conventions. Re-import any time with `npm run seed`
  (idempotent — upserts on title+author).
- `seed/source-pool.json` — the vetted source list `fetch-candidates.ts`
  samples from. Grow it deliberately (verify a URL actually resolves to the
  right work before adding it); the script never discovers sources on its own.
- `scripts/fetch-candidates.ts` / `load-candidates.ts` / `promote-candidate.ts`
  — the content pipeline described below.
- `db/migrations/0002_scalable_schema.sql` — the schema (authors, tags,
  works, content_candidates, works_feed); `0003_curation_and_dedup.sql` adds
  fuzzy dedup, `rights_status`, and source tiering. See "Content pipeline"
  below for the design.
- `ROADMAP.md` — ideas specced but deliberately not built yet (licensed
  content, a physical-book "companion" mode, diversity-balanced rotation,
  guest curators) — read before re-deriving any of those from scratch.

## Content pipeline

The schema (`db/migrations/0002_scalable_schema.sql`) is built around one
idea: **nothing reaches readers without passing through a review step**,
regardless of where it came from.

```
                 ┌─ hand-curated (seed/works.json) ──────┐
                 │                                        │
source_pool ──▶ content_candidates ──(reviewed, approved)──▶ works ──▶ works_feed ──▶ app
                 │  status: needs_review/                │
                 │  rejected/approved                     │
                 └─ future: user submissions ─────────────┘
```

- **`works`** — the live catalog. `author_id` references `authors` (one row
  per author, not a bio string duplicated on every piece); tags are a real
  `tags` + `work_tags` join, not a text array. `status` is an enum
  (`draft` / `needs_review` / `approved` / `rejected` / `archived`) —
  the app only ever reads `status = 'approved'` rows, via `is_active` on the
  `works_feed` view below.
- **`works_feed`** — a view that flattens `works` back to the exact shape
  the app already queries (`author` as a plain string, `tags` as an array,
  `is_active` computed from `status`). This is what every query in `app/`
  actually selects from — it's why none of the application code needed to
  change when the schema underneath it did.
- **`content_candidates`** — a staging table. Nothing here is ever visible
  to readers. Two things land here today:
  - `npm run fetch-candidates` — pulls from `seed/source-pool.json` (a
    small, hand-verified list of source URLs, meant to grow deliberately,
    not autogenerate), fetches the text, and stages it with
    `status = 'needs_review'`. Gutenberg text is cleaned by stripping the
    license-header/footer boilerplate; Wikisource pages go through
    MediaWiki's own plaintext-extraction API (falling back to pulling the
    literal contents of a `<poem>...</poem>` tag for poem pages the extracts
    API renders empty) rather than staging raw wikitext. No description yet
    — it's flagged unreviewed on purpose. Also computes `rights_status`
    (`lib/rights.ts` — public domain only if the year/death-year math
    actually clears the bar, never assumed) and a `source_tier`
    (`high_trust` for Standard Ebooks, `standard` for Gutenberg/Wikisource,
    `ocr_unverified` for anything else, e.g. Internet Archive), and skips
    anything that's a near-duplicate (via `pg_trgm` title similarity) of
    something already staged or already live.
  - An agent-assisted batch fetch (same approach used for the original
    30-work corpus: WebFetch + careful extraction, never reproduced from
    memory) — higher quality than the mechanical path since an agent can
    actually judge whether an anthology page extracted the right passage, or
    resolve a Wikisource page built from scanned-page transclusion that the
    mechanical fetch path can't (see `ROADMAP.md`). Load a batch with
    `npm run load-candidates -- path/to/batch.json` — same near-duplicate
    and rights-status handling as the mechanical path.
  - **Room for later, not built now**: a `origin = 'user_submitted'` value
    and `submitted_by` column already exist on `content_candidates`. A future
    "suggest a work" form would insert rows here with those fields set —
    same table, same review step, same promotion path. No migration needed
    when that ships.
- **Review**: `npm run review` lists everything with `status = 'needs_review'`.
  `npm run review -- edit <id> --description=... --tags=a,b,c [...]` fills
  in the fields the fetch step deliberately leaves blank, without touching
  SQL directly. `npm run review -- promote <id> --era=<era> [--difficulty=...]`
  requires an explicit `--era` (no more silently-null eras) and refuses to
  promote anything whose `rights_status` isn't `public_domain` unless you
  pass `--force-pd` — a reviewer has to make that call, not the pipeline.
  `npm run review -- reject <id> "reason"` marks it rejected (kept, not
  deleted — an audit trail of what was considered and why).
- **"Randomize but keep it high quality"**: randomness is scoped to *which*
  pool entries get fetched in a given run (`fetch-candidates.ts` shuffles
  `source-pool.json` before sampling), never to *what's in* the pool or
  *whether* something goes live. The quality gate is the review step, not
  the fetch step — a script can discover things unsupervised; only a human
  (or a more careful agent pass) approves them. (Not to be confused with the
  reader-facing **Shuffle** feature described above — that's a separate,
  much smaller idea: giving one reader an alternate pick, never touching
  what's in the catalog or what anyone else sees.)

## Adding content

Two paths, same destination (`works`, via review):

- **Hand-curated**: add entries to `seed/works.json` (see `seed/README.md`
  for conventions), then `npm run seed` — this path skips the review queue
  entirely (`origin = 'curated'`, inserted as `status = 'approved'`
  directly) since it's already been through a full agent-assisted
  verification pass before it reaches the file.
- **Fetched**: `npm run fetch-candidates -- <count>` (grow
  `seed/source-pool.json` first) or `npm run load-candidates -- <file>` for
  an agent-fetched batch, then `npm run review` to approve or reject each one.
