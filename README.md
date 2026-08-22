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

This file covers what the app is and how it's built. For how to ship a
change, roll one back, rotate a secret, or move any piece of this to
different infrastructure, see `OPERATIONS.md`.

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

2. Apply the schema (run migrations in order — `0001` through `0004`),
   either via `psql` or by pasting each file into the Neon SQL editor:

   ```bash
   psql "$DATABASE_URL" -f db/migrations/0001_init.sql
   psql "$DATABASE_URL" -f db/migrations/0002_scalable_schema.sql
   psql "$DATABASE_URL" -f db/migrations/0003_curation_and_dedup.sql
   psql "$DATABASE_URL" -f db/migrations/0004_author_portraits.sql
   ```

   `0002` is what actually defines the current schema (normalized authors/
   tags, a publishing pipeline, a `works_feed` view) — `0001`'s `works` table
   only exists so `0002` has something to replace; a fresh Neon project can
   run both back to back with no issue. `0003` adds `pg_trgm`-based fuzzy
   dedup, a `rights_status` column (replacing a hardcoded `public_domain =
   true`), and source-trust tiering. `0004` adds `authors.portrait_source_url`
   — see "Author portraits" below.

3. Seed the content catalog from `seed/works.json`:

   ```bash
   npm run seed
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

5. Before pushing any change, run what CI runs: `npm run lint`, `npx tsc
   --noEmit`, `npm test`, `npm run build`. `npm test` runs the pure-logic
   suite in `test/` (day-numbering, the daily-selection algorithm, the
   public-domain date math, archive-day generation) via Node's built-in
   test runner — no extra dependency, `tsx --test test/*.test.ts` under
   the hood.

## Deploy to Vercel

The app is stateless besides the Neon connection, so deployment is just:
"point Vercel at the repo, give it `DATABASE_URL`."

1. Push this repo to GitHub (already set up — `origin` points at
   `github.com/PaulLin1/oneoneone`).
2. In Vercel: **Add New → Project → Import** the GitHub repo. Framework
   preset auto-detects as Next.js; build command (`next build`) and output
   need no changes.
3. Before the first deploy (or right after — it only affects runtime, not
   the build, see below), add one environment variable in the Vercel
   project's **Settings → Environment Variables**:
   - `DATABASE_URL` — the same Neon pooled-connection string from your
     `.env.local`. Set it for all three environments (Production, Preview,
     Development) unless you want previews hitting a separate Neon branch —
     Neon's branching feature pairs well with Vercel preview deployments if
     you want that later.
4. Make sure the target Neon database has actually had the three
   migrations applied and been seeded (see "Setup" above) — Vercel deploys
   the app, not the schema; a fresh Neon project needs that done once, by
   hand, before or after the first deploy.
5. Deploy. Every push to `main` redeploys Production; every other branch/PR
   gets its own Preview URL automatically — no extra config.

`next build` itself never touches the database (every DB-reading route is
server-rendered on demand — see the route table produced by `npm run
build` — not statically prerendered), so a missing or wrong `DATABASE_URL`
only ever surfaces as a runtime error on a page load, never a failed build.

## Automation

Two GitHub Actions workflows. Both need a one-time setup step in
**Settings → Secrets and variables → Actions** — after that, nothing here
needs a human to run anything.

- **`.github/workflows/ci.yml`** — every push/PR to `main`: `npm run lint`,
  `tsc --noEmit`, `npm test`, then `npm run build`. No secrets required
  (the build never touches the database — see the Vercel section above).
- **Dependabot** (`.github/dependabot.yml`) — weekly PRs for outdated npm
  and GitHub Actions dependencies, gated by `ci.yml` like any other PR
  before merging. Next/React/`eslint-config-next` are grouped into one PR
  since they need to move together.
- **`.github/workflows/content-pipeline.yml`** — the actual content and
  author-portrait pipeline, running unattended on a weekly schedule
  (Mondays, also triggerable by hand from the Actions tab). This isn't a
  mechanical script: it runs a real Claude Code agent
  (`anthropics/claude-code-action`) inside the workflow, doing exactly what
  a human reviewer would — fetch candidates, read and judge each one
  against the sourcing/rights/quality rules in this file and
  `seed/README.md`, promote or reject, then find any author still missing
  a portrait and run + visually QA that pipeline too. The full prompt is in
  the workflow file itself. Needs two secrets:
  - `DATABASE_URL` — same Neon connection string as everywhere else.
  - `ANTHROPIC_API_KEY` — an Anthropic API key (console.anthropic.com),
    scoped to whatever spend limit you're comfortable with; each run
    consumes real API usage.

  **To check on it**: the Actions tab shows each run's log directly, same
  as `ci.yml`. Nothing it does is silent or hidden — promotions/rejections
  show up as normal `npm run review` output in the log, and any files it
  changed (new portraits, `lib/authorPortraits.ts`, `seed/source-pool.json`)
  land in a normal commit to `main` you can read like any other.

  **To intervene**: nothing about this workflow prevents also running any
  of the underlying commands (`npm run review`, `npm run
  fetch-author-portrait`, etc.) by hand against the same database — the
  agent isn't doing anything a human couldn't do with the same scripts. If
  a specific promotion or portrait looks wrong, fix or revert it the same
  way you'd fix any other mistake in the catalog (see "Content pipeline"
  and "Author portraits" below for the manual commands).

## Project layout

- `app/` — pages: `/` (today's three), `/read/[category]` (reading view,
  with an opt-in Shuffle), `/work/[id]` (exploratory reads), `/archive`
  (list of every past day — click one to expand a dropdown of its three),
  `/archive/[day]/[category]` (same reading-flow chrome as `/read`, for an
  archived day), `/today` (redirects to `/`), `/about`, `/privacy` (privacy
  + terms), `app/api/daily-selection` (GET route serving the day's puzzle),
  `app/api/randomize` (GET route backing Shuffle — outside the daily
  selection contract, see "Shuffle" above)
- `components/Masthead.tsx` / `components/Footer.tsx` — persistent chrome
  mounted once in `app/layout.tsx`, present on every page. Masthead carries
  the wordmark + Archive link; Footer is the compact nav row (Archive,
  About, Contact, Privacy & Terms, copyright) kept deliberately short since
  it's on screen even during reading.
- `components/ReadingFlow.tsx` — the shared stepper chrome (back link,
  clickable progress boxes, reading view) used by both
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
  Also handles Neon's serverless cold start: concurrent mounts (Masthead +
  a page) dedupe into one in-flight fetch, a 25s timeout distinguishes a
  slow-but-working wake-up from a genuinely stuck request, the UI surfaces
  "still waking up" after 4s instead of a bare spinner, and a failed load
  exposes a manual `retry`.
- `lib/categoryColor.ts` — the poem/essay/story color mapping shared by
  every component that shows a category (cards, badges, progress dots)
- `lib/rights.ts` — computes `rights_status` (`public_domain` /
  `unverified`) from a publication year or author death year; used by the
  fetch/load pipeline so nothing gets marked public domain without the math
  actually clearing the U.S. 96-years-after-publication bar.
- `lib/authorPortraits.ts` — the hand-maintained set of authors with a
  processed portrait asset in `public/authors/`, plus `authorSlug()`. See
  "Author portraits" below.
- `seed/works.json` — the hand-curated content catalog; see `seed/README.md`
  for curation conventions. Re-import any time with `npm run seed`
  (idempotent — upserts on title+author).
- `seed/source-pool.json` — the vetted source list `fetch-candidates.ts`
  samples from. Grown deliberately (a URL has to actually resolve to the
  right work before landing here) — `fetch-candidates.ts` itself never
  discovers sources on its own; `content-pipeline.yml`'s agent does that
  research step when the pool runs dry, verifying before adding, same
  standard as everything else here.
- `scripts/fetch-candidates.ts` / `load-candidates.ts` / `promote-candidate.ts`
  — the content pipeline described below.
- `scripts/fetch-author-portrait.ts` / `process-author-portraits.ts` — fetch
  + process steps of the author-portrait pipeline. See "Author portraits"
  below.
- `.github/workflows/content-pipeline.yml` — runs the content + portrait
  pipeline unattended on a schedule via a Claude Code agent. See
  "Automation" above.
- `db/migrations/0002_scalable_schema.sql` — the schema (authors, tags,
  works, content_candidates, works_feed); `0003_curation_and_dedup.sql` adds
  fuzzy dedup, `rights_status`, and source tiering; `0004_author_portraits.sql`
  adds `authors.portrait_source_url`. See "Content pipeline" below for the
  design.
- `ROADMAP.md` — ideas specced but deliberately not built yet (licensed
  content, a physical-book "companion" mode, diversity-balanced rotation,
  guest curators) — read before re-deriving any of those from scratch.
- `OPERATIONS.md` — the runbook: shipping and rolling back changes,
  database migrations, pausing/undoing the automated pipeline, secrets
  reference, moving to different infrastructure, troubleshooting.
- `test/` — pure-logic unit tests (day-numbering, daily-selection,
  public-domain date math, archive-day generation, author-slug
  formatting), run via `npm test` (Node's built-in test runner through
  `tsx`, no added test-framework dependency).

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
  deleted — an audit trail of what was considered and why). As of
  `content-pipeline.yml` (see "Automation" above), this review step runs on
  a schedule via a Claude Code agent instead of a human at a terminal — same
  commands, same rules, just unattended. The commands themselves don't care
  who's running them; use them by hand any time you want to intervene.
- **"Randomize but keep it high quality"**: randomness is scoped to *which*
  pool entries get fetched in a given run (`fetch-candidates.ts` shuffles
  `source-pool.json` before sampling), never to *what's in* the pool or
  *whether* something goes live. The quality gate is the review step, not
  the fetch step — a script can discover things unsupervised; only a
  reviewer (human, or the scheduled agent standing in for one) approves
  them. (Not to be confused with the reader-facing **Shuffle** feature
  described above — that's a separate, much smaller idea: giving one
  reader an alternate pick, never touching what's in the catalog or what
  anyone else sees.)

## Adding content

Two paths, same destination (`works`, via review):

- **Hand-curated**: add entries to `seed/works.json` (see `seed/README.md`
  for conventions), then `npm run seed` — this path skips the review queue
  entirely (`origin = 'curated'`, inserted as `status = 'approved'`
  directly) since it's already been through a full agent-assisted
  verification pass before it reaches the file.
- **Fetched**: happens on its own now — `content-pipeline.yml` fetches,
  grows `seed/source-pool.json` when it runs dry, and reviews/promotes
  weekly (see "Automation" above). To do a pass immediately instead of
  waiting for the schedule, trigger it by hand from the Actions tab
  (`workflow_dispatch`), or run the same commands locally: `npm run
  fetch-candidates -- <count>` / `npm run load-candidates -- <file>`, then
  `npm run review` to approve or reject each one.

## Author portraits

Three steps, same as always — fetch raw material, process it into the
site's style, wire it up — but all three now run automatically as part of
`content-pipeline.yml` (see "Automation" above) whenever a newly-promoted
work's author doesn't have one yet. Portraits stay off the `content_candidates`
review queue regardless of who/what runs this — there's no `status` column
on `authors` at all, so there's no candidate table to land in; the gate is
entirely the visual QA step below.

1. **Fetch**: `npm run fetch-author-portrait -- "Author Name"`, or
   `npm run fetch-author-portrait -- --all` to sweep every author currently
   missing `portrait_source_url`. For each name it:
   - queries Wikipedia's REST summary API for that author's short
     `description` (e.g. `"American writer and critic (1809–1849)"`) and
     parses `birth_year`/`death_year` out of it — the plaintext `extract`
     field strips parentheticals, so `description` is the reliable field,
     not `extract`;
   - downloads the raw lead image to `public/authors/_source/<slug>.<ext>`
     (gitignored — a working file, never committed, never served);
   - upserts `birth_year`, `death_year`, and `portrait_source_url` onto the
     `authors` row, **only where currently null** (`coalesce`) — it never
     overwrites a hand-corrected value, and it never touches `bio` at all,
     since that column is `author_note` in the reading view and is
     explicitly hand-written editorial content (see `seed/README.md`), not
     something to auto-fill from a scraped extract. The extract still
     prints to the console as a starting point for whoever writes that bio
     by hand.
   - A retry step strips a trailing curator disambiguator (`"Saki (H. H.
     Munro)"` → `"Saki"`) on a 404, since that's a catalog convention, not
     a real Wikipedia article title.
2. **Process**: `npm run process-author-portraits` turns every
   staged raw image into the site's flat black-and-white mark — content-box
   crop (zooms toward the actual subject, not just sharp's non-zooming
   attention gravity), a blur pass before threshold to suppress halftone/
   scan-dot noise, a connected-component pass that erases small isolated
   ink specks outside the actual silhouette back to background (stray dots
   that survive the blur — see the comment atop `lib/authorPortraits.ts`
   for what this catches and what it doesn't), then encodes the result as
   an alpha-channel stencil (solid black RGB, shape lives in transparency)
   matching how `CategoryColumn`/`ReadingView`'s `mask-image` actually
   expects it — *not* a plain opaque black/white PNG, which renders as a
   solid colored square (browsers fall back to inverted luminance masking
   without an alpha channel). Pass `--force` to reprocess an author who
   already has an output. This is mechanical and doesn't always work:
   source photos with a lot of blank margin, heavy scan degradation, dense
   large-area noise the speck filter can't touch, actual background clutter
   in the source photo, or a Wikipedia lead image that isn't actually a
   headshot (a memorial statue, say) can come out illegible.
3. **QA + wire it up**: this is the step that used to be "by hand, forever"
   — actually looking at each `public/authors/<slug>.png` and judging
   whether it's legible before adding the author's exact name string to
   `AUTHORS_WITH_PORTRAIT` in `lib/authorPortraits.ts` (the only thing that
   gates whether a portrait renders — no file-existence check). The
   scheduled agent does this with the Read tool, same visual judgment a
   human would apply; a bad result gets its output file deleted rather than
   wired in and left broken. To do this pass yourself instead of waiting
   for the schedule: process, then open each new `public/authors/*.png` and
   look — a good one is a clear, recognizable, tightly-cropped face; add it
   to the set. A bad one gets deleted.

Before using any fetched image for real: verify its own license on
Wikipedia/Commons. An author's *writing* being public domain says nothing
about whether a particular 20th-century photograph of them is — some
portraits on Commons are CC-BY-SA or otherwise restricted, not PD.
