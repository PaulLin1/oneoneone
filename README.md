# oneoneone

---
title: "oneoneone"
date: "2026"
tags: ["Next.js", "Full-Stack", "Personal Project"]
---

oneoneone is a daily reading site. Every day it picks one poem, one essay, and one short
story, and everyone who visits sees the same three, the same way every Wordle player gets
the same puzzle. There's no feed, no personalization, no algorithm tuned to what you already
read. The picks come from a fixed, deterministic rotation, so the same date always produces
the same three works for every reader, and I never have to store or compute anything per
visitor to make that true.

The idea comes from something Ray Bradbury said about his own habits: for a thousand nights
early in his career he read one short story, one poem, and one essay before bed, on purpose
picking things dense enough with imagery and ideas that his head filled up faster than he
could consciously track. He credited that routine with a lot of his own writing. oneoneone
runs that same routine automatically and makes it public, using public domain works pulled
from Project Gutenberg, Wikisource, and similar archives, each one checked before it goes
live.

Under the hood it's a Next.js app on Neon Postgres, with a scheduled pipeline that finds new
candidate works, checks their rights status, and reviews them, all through the same code path
whether a human or an unattended agent is running it. Signing in with Google is optional and
only adds a private reading history and the ability to recommend a work for the catalog; the
daily rotation itself never changes based on who's looking.

Read it at [readoneoneone.com](https://readoneoneone.com).

One poem. One essay. One story. The same three, for everyone, every day.

A shared daily reading ritual — like Wordle, not a personalized feed. The
day's three works are picked by a fixed, deterministic rotation (same date
in → same three out, for every reader, everywhere). No account is needed —
today's selection is cached in `localStorage` purely so a page refresh
doesn't re-fetch it; nothing about what you've read is recorded anywhere
unless you choose to sign in (see "Accounts" below — entirely opt-in, and
the daily rotation itself is never personalized either way).

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

No in-app discussion or comments — the site is deliberately just the
reading + the share hook; if people want to talk about a day, that happens
wherever they already are, via the hashtag. An account adds two things and
nothing else: a private reading history, and the ability to recommend a
work for the catalog. It's never required, and it never changes what the
daily rotation shows anyone.

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

2. Apply the schema (run migrations in order — `0001` through `0009`),
   either via `psql` or by pasting each file into the Neon SQL editor:

   ```bash
   psql "$DATABASE_URL" -f db/migrations/0001_init.sql
   psql "$DATABASE_URL" -f db/migrations/0002_scalable_schema.sql
   psql "$DATABASE_URL" -f db/migrations/0003_curation_and_dedup.sql
   psql "$DATABASE_URL" -f db/migrations/0004_author_portraits.sql
   psql "$DATABASE_URL" -f db/migrations/0005_accounts.sql
   psql "$DATABASE_URL" -f db/migrations/0006_portrait_urls.sql
   psql "$DATABASE_URL" -f db/migrations/0007_reading_calendar.sql
   psql "$DATABASE_URL" -f db/migrations/0008_multi_read_calendar.sql
   psql "$DATABASE_URL" -f db/migrations/0009_daily_singleton.sql
   ```

   `0002` is what actually defines the current schema (normalized authors/
   tags, a publishing pipeline, a `works_feed` view) — `0001`'s `works` table
   only exists so `0002` has something to replace; a fresh Neon project can
   run both back to back with no issue. `0003` adds `pg_trgm`-based fuzzy
   dedup, a `rights_status` column (replacing a hardcoded `public_domain =
   true`), and source-trust tiering. `0004` adds `authors.portrait_source_url`
   — see "Author portraits" below. `0005` adds accounts, sessions, and
   reading history — see "Accounts" below; the app runs fully without ever
   configuring sign-in, this just needs the tables to exist. `0006` adds
   `authors.portrait_url` (the actual, published portrait) and joins it
   through `works_feed` — see "Author portraits" below. `0007` reshapes
   `reading_history` from "have I ever read this work" into a per-(user,
   category, day) calendar. `0008` lets a (user, category, day) slot hold
   more than one read and records how each one happened (the day's official
   pick, a shuffle, an archived day's pick read later, or something read
   outside the site). `0009` makes `'daily'` a singleton per (user,
   category, day) — a fresh daily-sourced read replaces the old one instead
   of sitting beside it, since `selectDailyWorks()` is recomputed from the
   live catalog on every request and can otherwise disagree with itself
   partway through the same day — see "Reading history" under "Accounts"
   below.

3. Seed the content catalog from `seed/works.json`:

   ```bash
   npm run seed
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Set `AUTH_SECRET`
   too (`npx auth secret`) — cheap, one-time, and avoids `auth()` logging
   an error on every request even before sign-in itself is configured.
   `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (real sign-in) and the R2
   portrait storage (`R2_*`) are both genuinely optional — see the
   comments in `.env.local.example` and "Accounts & reviewers" in
   `OPERATIONS.md` for setting those up.

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
   the build, see below), add environment variables in the Vercel
   project's **Settings → Environment Variables**:
   - `DATABASE_URL` — the same Neon pooled-connection string from your
     `.env.local`. Set it for all three environments (Production, Preview,
     Development) unless you want previews hitting a separate Neon branch —
     Neon's branching feature pairs well with Vercel preview deployments if
     you want that later.
   - `AUTH_SECRET` — set this even if you're not setting up sign-in yet
     (`npx auth secret`); its absence logs an error on every request. The
     rest of the site (including anonymous reading) works regardless.
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — optional, only needed for
     sign-in to actually work in production (see "Accounts & reviewers" in
     `OPERATIONS.md`). Add
     `https://<your-vercel-domain>/api/auth/callback/google` as an
     authorized redirect URI in the Google OAuth client for this to work.
   - `R2_*` — optional, only for the author-portrait pipeline's image
     storage.
4. Make sure the target Neon database has actually had the migrations
   applied and been seeded (see "Setup" above) — Vercel deploys the app,
   not the schema; a fresh Neon project needs that done once, by hand,
   before or after the first deploy.
5. Deploy. Every push to `main` redeploys Production; every other branch/PR
   gets its own Preview URL automatically — no extra config.

`next build` itself never touches the database (every DB-reading route is
server-rendered on demand — see the route table produced by `npm run
build` — not statically prerendered), so a missing or wrong `DATABASE_URL`
only ever surfaces as a runtime error on a page load, never a failed build.

## Automation

Three GitHub Actions workflows. All three need a one-time setup step in
**Settings → Secrets and variables → Actions** — after that, nothing here
needs a human to run anything.

- **`.github/workflows/ci.yml`** — every push/PR to `main`: `npm run lint`,
  `tsc --noEmit`, `npm test`, then `npm run build`. No secrets required
  (the build never touches the database — see the Vercel section above).
- **Dependabot** (`.github/dependabot.yml`) — weekly PRs for outdated npm
  and GitHub Actions dependencies, gated by `ci.yml` like any other PR
  before merging. Next/React/`eslint-config-next` are grouped into one PR
  since they need to move together.
- **`.github/workflows/content-pipeline.yml`** — fetches and reviews new
  candidates, running unattended on a weekly schedule (Mondays, also
  triggerable by hand from the Actions tab). This isn't a mechanical
  script: it runs a real Claude Code agent (`anthropics/claude-code-action`)
  inside the workflow, doing exactly what a human reviewer would — fetch
  candidates, read and judge each one against the sourcing/rights/quality
  rules in this file and `seed/README.md`, promote or reject. The full
  prompt is in the workflow file itself, and it's deliberately capped
  (candidates per run, web searches per run) so a normal run stays short.
  It's also pinned to Sonnet and given a hard `--max-budget-usd` ceiling —
  not just a "should stay small" prompt instruction, an actual spend limit
  the CLI enforces — plus a `timeout-minutes` on the job as a second,
  independent backstop. See the comments in the workflow file if you're
  tuning any of those numbers. Needs `DATABASE_URL` and `ANTHROPIC_API_KEY`
  (an Anthropic API key from console.anthropic.com, scoped to whatever
  spend limit you're comfortable with — each run consumes real API usage
  regardless of the per-run cap above).
- **`.github/workflows/author-portraits.yml`** — fills in missing author
  portraits, split into its own workflow from the above because portrait
  hunting (web search, image processing, and looking at every attempt with
  the Read tool) is the expensive part of this whole pipeline and doesn't
  need to happen every week. Runs monthly (1st of the month), also
  triggerable by hand. Capped at 3 authors and 2 attempts per author per
  run — leftover authors just get picked up next month; the initial-letter
  fallback in `components/AuthorMark.tsx` covers the gap in the meantime.
  Same Sonnet pin, `--max-budget-usd`, and `timeout-minutes` backstops as
  `content-pipeline.yml` above. Needs `DATABASE_URL`, `ANTHROPIC_API_KEY`,
  and the `R2_*` secrets (see
  "Author portraits" below) — without `R2_*` it has nothing to publish to,
  so don't bother enabling this one until those are set.

  **To check on either**: the Actions tab shows each run's log directly,
  same as `ci.yml`. Nothing they do is silent or hidden — promotions/
  rejections show up as normal `npm run review` output in the log,
  portrait publishes as normal `npm run publish-author-portrait` output,
  and any *files* changed (usually just `seed/source-pool.json`, if
  anything — portraits publish straight to R2/the database, no file
  involved) land in a normal commit to `main` you can read like any other.

  **To intervene**: nothing about either workflow prevents also running
  any of the underlying commands (`npm run review`, `npm run
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
- `lib/authorPortraits.ts` — just `authorSlug()` now, the naming
  convention used to derive an R2 object key from an author's name.
  Portrait display itself is entirely DB-driven — see "Author portraits"
  below.
- `lib/r2.ts` — the Cloudflare R2 client (S3-compatible, via
  `@aws-sdk/client-s3`) portraits upload to. Lazily constructed for the
  same reason `lib/auth-db.ts`'s Pool is: importable from a route bundled
  at `next build` time without needing R2 credentials just to build.
- `scripts/setup-r2-cors.ts` — one-time bucket setup (`npm run
  setup-r2-cors`) so portraits actually render (see "Author portraits"
  below for why this is needed at all).
- `components/AuthorMark.tsx` — renders an author's real portrait (CSS
  `mask-image`) or, when `author_portrait_url` is null, a generated
  initial-letter fallback — see "Author portraits" below for why this is
  what makes coverage 100%.
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
- `scripts/fetch-author-portrait.ts` / `process-author-portraits.ts` /
  `publish-author-portrait.ts` — the fetch / process / publish steps of the
  author-portrait pipeline. See "Author portraits" below.
- `.github/workflows/content-pipeline.yml` — runs the content + portrait
  pipeline unattended on a schedule via a Claude Code agent. See
  "Automation" above.
- `db/migrations/0002_scalable_schema.sql` — the schema (authors, tags,
  works, content_candidates, works_feed); `0003_curation_and_dedup.sql` adds
  fuzzy dedup, `rights_status`, and source tiering; `0004_author_portraits.sql`
  adds `authors.portrait_source_url`; `0006_portrait_urls.sql` adds
  `authors.portrait_url` (the published portrait) and joins it through
  `works_feed`. See "Content pipeline" and "Author portraits" below for the
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
- **Recommended**: a signed-in reader submitting a work via `/recommend` —
  see "Accounts" below. Lands in the exact same `content_candidates` queue
  as everything else, `origin = 'user_submitted'`, reviewed the same way.

## Accounts

Entirely optional — see the `/privacy` page for the reader-facing version
of this. Nothing about the daily rotation, Archive, or Shuffle changes
whether you're signed in or not; an account only adds a private reading
history and the ability to recommend a work.

- **Auth**: [Auth.js v5](https://authjs.dev) (`next-auth@beta`) with Google
  as the only provider — `lib/auth.ts`. Database sessions (not JWT): a
  session can be revoked server-side by deleting its row, which a bare JWT
  can't be. `@auth/neon-adapter` talks to Postgres through
  `@neondatabase/serverless`'s `Pool` (a different client shape than
  `lib/db.ts`'s `neon()` HTTP client used everywhere else — `lib/auth-db.ts`
  wraps it in a Proxy that defers actually constructing the Pool, and
  therefore touching `DATABASE_URL`, until a query happens at request time;
  without that, `next build` would need the env var just to bundle a route
  that imports `lib/auth.ts`, which every page does transitively through
  `Masthead`).
- **Schema**: `db/migrations/0005_accounts.sql` — `users` / `accounts` /
  `sessions` / `verification_token` are the exact shape
  `@auth/neon-adapter` expects (verified against its source, not just the
  adapter docs). `users.role` (`reader` / `reviewer` / `admin`) gates the
  review UI below — nobody self-assigns it; promoting a reader to reviewer
  is a deliberate `update users set role = 'reviewer' where email = '...'`
  run by hand.
- **Reading history**: `reading_history` is a log, not a single slot — a
  (user, category, day) can hold several rows (0008), so reading that
  day's official pick *and* a shuffle both show up rather than the second
  silently overwriting the first. `read_date` is always the day a row was
  actually opened, even for an archived day's pick read later — `source`
  (`daily` / `random` / `archive` / `external`) records how it was read,
  and `source_date` additionally carries *which* day an `'archive'` row's
  selection is actually from, so `/account` can show "from `<date>`"
  instead of presenting it as that day's canonical pick.
  `components/ReadingView.tsx` posts to `app/api/reading-history/route.ts`
  on every mount, signed in or not — the route itself checks the session
  and no-ops for anonymous requests, which is what keeps ReadingView from
  needing a `SessionProvider` wrapped around the app just for this one
  call; reopening the exact same work in the same slot just bumps
  `read_at` (the partial unique index on `(user_id, category, read_date,
  work_id) where work_id is not null`), it doesn't duplicate. `'daily'` is
  the one exception to "multiple reads coexist": it's a singleton per
  (user, category, day) (0009's partial unique index on `(user_id,
  category, read_date) where source = 'daily'`) — a fresh daily-sourced
  read *replaces* whichever work was previously logged as that day's pick
  rather than sitting beside it, because `selectDailyWorks()` is
  recomputed from the live catalog on every request and can genuinely
  disagree with itself between two visits on the same calendar day if the
  active-works set changed in between. `/account`
  renders this as a GitHub-contributions-style calendar
  (`lib/readingCalendar.ts` builds the week grid, `components/
  ReadingCalendar.tsx` renders it and each day's detail panel, one entry
  per row with a Clear) going back `CALENDAR_WEEKS`
  (`app/account/page.tsx`). Something read outside the site can be added
  to any past or present slot via `app/api/reading-history/entry/route.ts`
  (`PUT` to add, typed in by hand — `external_title`/`external_author`,
  `work_id` left null; `DELETE` to remove one row by id). A row's source
  is exactly a catalog work or external text, never both — enforced by
  `reading_history_source_check`, not left to application code alone.
- **Recommendations**: `/recommend` posts to `app/api/recommend/route.ts`,
  which requires a session and inserts directly into `content_candidates`
  with `origin = 'user_submitted'` and `submitted_by` set to the reader's
  id — columns that existed, unused, since `0002_scalable_schema.sql`. A
  recommendation is deliberately a stub, not a ready candidate:
  `text_content` stays null (there's no promise the submitter has verbatim,
  sourced text), so `scripts/promote-candidate.ts` /
  `lib/contentReview.ts` already refuse to promote it as-is — a reviewer
  has to actually go find and verify the text first, same as any
  mechanically-fetched candidate missing a description.
- **Manual review UI**: `/admin/review` (list) and `/admin/review/[id]`
  (detail — edit fields, promote, or reject), gated on
  `role in ('reviewer', 'admin')`. This calls the exact same functions in
  `lib/contentReview.ts` that `scripts/promote-candidate.ts` calls — the
  CLI a human or the scheduled agent runs and the web UI a reviewer without
  terminal access uses are two front ends on one set of rules, not two
  copies that could drift apart.
- **`source_url` is now nullable** on `content_candidates` (a
  recommendation may not come with one), but promotion requires one before
  a work can go live — enforced in `lib/contentReview.ts`, not left to a
  database constraint alone.

## Author portraits

Fully database-driven — `authors.portrait_url` (added in
`db/migrations/0006_portrait_urls.sql`) is the only thing that decides what
renders, joined through as `work.author_portrait_url` via `works_feed`.
There's no static file, no hand-maintained list of names in code: adding,
replacing, or removing a portrait is a data change (a Cloudflare R2 upload
+ one `update authors`), not a code change — no commit, no redeploy.

**The goal is a real photo for every author, not a fallback.** All 26
current authors have one — every one of them was verified to actually
render a legible face before being published; several took multiple
source-image attempts and a manual pre-crop to get right (see the
"Author portraits" step in `.github/workflows/content-pipeline.yml` for
the actual technique: prefer engravings/etchings over paintings, prefer a
plain background over a candid/environmental shot, pre-crop tightly with
sharp when the subject is small in the frame rather than trusting
`process-author-portraits.ts`'s own content-detection to find it). The
scheduled agent keeps trying — alternate Wikimedia Commons sources, a
manual crop — rather than accepting the first failed attempt.

`components/AuthorMark.tsx` does still render a generated initial-letter
mark when `author_portrait_url` is `null`, in the category's accent color
— that exists purely so a *brand-new* author never renders broken in the
short window between being promoted and getting a portrait published, not
as a permanent, acceptable end state. If you see one in normal use, that's
a gap to close (see above), not a design feature.

R2 is optional infrastructure for the real-photo half of this — without
`R2_*` configured (see the secrets table in `OPERATIONS.md`), every author
falls back to their initial. Nothing breaks, but that's a config gap to
fix, not an intended mode. **After setting `R2_*`, run `npm run
setup-r2-cors` once** — R2 buckets have no CORS policy by default, and
without one, portraits render as blank space (not a broken-image icon,
fully invisible) specifically in Safari/WebKit-family browsers: CSS
`mask-image` treats a cross-origin image as a sub-resource load subject to
CORS, unlike a plain `<img>` or a direct navigation to the same URL, which
is why the object can look perfectly reachable (it is) while still not
rendering on the page.

Three steps to add a real one, all runnable by hand or automatically by
`content-pipeline.yml` (see "Automation" above) for any approved work's
author still missing one:

1. **Fetch**: `npm run fetch-author-portrait -- "Author Name"`, or
   `npm run fetch-author-portrait -- --all` to sweep every author never
   fetched yet. For each name it:
   - queries Wikipedia's REST summary API for that author's short
     `description` (e.g. `"American writer and critic (1809–1849)"`) and
     parses `birth_year`/`death_year` out of it — the plaintext `extract`
     field strips parentheticals, so `description` is the reliable field,
     not `extract`;
   - downloads the raw lead image to `public/authors/_source/<slug>.<ext>`
     (gitignored — working files, never committed);
   - upserts `birth_year`, `death_year`, and `portrait_source_url` (the raw
     image's own URL — provenance, distinct from `portrait_url`, the
     *published* R2 asset) onto the `authors` row, **only where currently
     null** (`coalesce`) — never overwrites a hand-corrected value, and
     never touches `bio`, which is hand-written editorial content (see
     `seed/README.md`), not something to auto-fill from a scraped extract.
     The extract still prints to the console as a starting point for
     whoever writes that bio by hand.
   - A retry step strips a trailing curator disambiguator (`"Saki (H. H.
     Munro)"` → `"Saki"`) on a 404, since that's a catalog convention, not
     a real Wikipedia article title.
2. **Process**: `npm run process-author-portraits` turns every staged raw
   image into the site's flat black-and-white mark — content-box crop
   (zooms toward the actual subject, not just sharp's non-zooming attention
   gravity), a blur pass before threshold to suppress halftone/scan-dot
   noise, a connected-component pass that erases small isolated ink specks
   outside the actual silhouette back to background (stray dots that
   survive the blur), then encodes the result as an alpha-channel stencil
   (solid black RGB, shape lives in transparency) matching how
   `AuthorMark`'s `mask-image` actually expects it — *not* a plain opaque
   black/white PNG, which renders as a solid colored square (browsers fall
   back to inverted luminance masking without an alpha channel). Output
   lands in `public/authors/_staging/<slug>.png` — gitignored, unreviewed,
   never served directly. Pass `--force` to reprocess an author already
   staged. This is mechanical and doesn't always work: source photos with a
   lot of blank margin, heavy scan degradation, dense large-area noise the
   speck filter can't touch, actual background clutter in the source photo,
   or a Wikipedia lead image that isn't actually a headshot (a memorial
   statue, say) can come out illegible.
3. **QA + publish**: look at each `public/authors/_staging/<slug>.png` —
   the scheduled agent does this with the Read tool, same visual judgment a
   human would apply. A good one (a real recognizable face, not a tiny
   sliver, not noise-eaten, correct crop) gets published:
   `npm run publish-author-portrait -- "Author Name"` (or `--all` for
   everything currently staged) uploads it to R2 and sets
   `authors.portrait_url` — that's the entire "wire it up" step now, no
   file to edit. A bad one just gets deleted from `_staging/`, left
   unpublished; that author keeps showing their fallback initial until
   someone tries again with a better source.

Before publishing any fetched image for real: verify its own license on
Wikipedia/Commons. An author's *writing* being public domain says nothing
about whether a particular 20th-century photograph of them is — some
portraits on Commons are CC-BY-SA or otherwise restricted, not PD.
