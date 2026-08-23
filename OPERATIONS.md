# Operations

A runbook for running this in production without having to re-derive
anything under pressure: how to ship a change, how to undo one, what each
piece of infrastructure is for, and what to do when something looks wrong.
`README.md` explains what the app is and how it's built; this is about
keeping it running.

## The moving parts, in one paragraph

Four things have to agree with each other: **Neon** (Postgres — content,
accounts, everything), **Vercel** (hosts the Next.js app, reads from Neon
at request time), **Cloudflare R2** (optional — author-portrait images;
without it, every author just shows a generated initial instead of a real
photo), and **GitHub** (the source of truth for code, plus two Actions:
`ci.yml` checks every push/PR, `content-pipeline.yml` grows the catalog and
author portraits on its own). Vercel and `content-pipeline.yml` each need
their own copy of `DATABASE_URL`; `content-pipeline.yml` also needs
`ANTHROPIC_API_KEY` and, if you want it publishing real portraits, the
`R2_*` secrets. The app itself is stateless besides the database
connection, which is what makes most of what follows straightforward.

## Making a change and shipping it

1. Make the change locally. Before pushing, run the same checks CI will
   run:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm test
   npm run build
   ```
   `npm test` covers the pure logic that's easy to silently break —
   day-numbering (`lib/epoch.ts`), the daily-selection algorithm
   (`lib/selection/`), the public-domain date math (`lib/rights.ts`),
   archive-day generation, and author-slug formatting. It won't catch a
   broken page or a bad migration; it will catch a Day N vs. Day N+1
   off-by-one or a rights-status boundary regression before either one
   silently starts shipping wrong content.
2. Commit and push to `main` (or open a PR — either works; `ci.yml` runs on
   both). Vercel picks up every push to `main` automatically and deploys
   it as Production; a PR gets its own Preview URL to look at first if you
   want that extra step.
3. If the change touches the database schema, see "Database changes"
   below — Vercel deploys the *app*, never the schema, so a migration has
   to be applied separately, by hand, against the live Neon database.

Nothing here requires a special branch strategy or a review gate — direct
pushes to `main` are the normal path, same as what `content-pipeline.yml`
already does on its own schedule.

## Rolling back a bad deploy

Vercel keeps every deployment. In the Vercel dashboard, under the
project's **Deployments** tab, find the last good one and use **Promote to
Production** (sometimes shown as "Instant Rollback") — this repoints
production at that build immediately, with no rebuild and no git history
rewrite. It does *not* touch the database; a bad deploy caused by a schema
mismatch needs the schema fixed too, not just the app rolled back.

To also fix it in git (recommended, so the next deploy from `main` doesn't
reintroduce the bug): `git revert` the offending commit(s) and push. Don't
force-push or rewrite history on `main` — revert forward.

## Database changes

- **Adding a migration**: new file in `db/migrations/`, numbered
  sequentially (`0007_whatever.sql`), following the style of the existing
  ones — a comment at the top explaining *why*, not just what. Apply it
  directly against the production Neon database:
  ```bash
  psql "$DATABASE_URL" -f db/migrations/0007_whatever.sql
  ```
  There's no separate staging database and no down-migrations — write
  migrations to be additive where possible (new nullable columns, new
  tables) so a mistake is easy to unwind by hand rather than requiring a
  paired rollback script. `0003_curation_and_dedup.sql`,
  `0004_author_portraits.sql`, `0005_accounts.sql`, and
  `0006_portrait_urls.sql` are all examples of purely additive migrations
  against a live schema.
- **If you want a safety net before running something against production**:
  Neon supports branching a database (a cheap, instant copy-on-write
  clone) from the Neon console — create a branch, point a local
  `.env.local` at its connection string, test the migration there first,
  then run it for real against the production branch. Not required, but
  available for anything that feels risky.
- **Undoing bad data** (not schema — actual bad rows): `works`/
  `content_candidates` rows aren't hard-deleted by the normal pipeline
  (`reject` sets `status = 'rejected'`, kept as an audit trail) — fixing a
  bad promotion is usually `npm run review -- reject <id> "reason"` plus,
  if it already reached `works`, a direct
  `update works set status = 'archived' where id = '...'` via `psql`
  (`works_feed`'s `is_active` is computed from `status = 'approved'`, so
  archiving immediately stops it from being served — no code change
  needed).
- **Point-in-time recovery**: Neon retains a restore window (length
  depends on your plan) accessible from the Neon console under the
  project's **Restore** tab — for anything worse than a few bad rows (an
  accidental `delete` with no `where`, say), that's the real undo button,
  not anything in this repo.

## The automated content pipeline

`content-pipeline.yml` runs weekly and does, unattended, what a human
reviewer would do by hand — see "Automation" and "Content pipeline" in
`README.md` for the full mechanics. Operationally, what matters:

- **Every run is visible**: the Actions tab has the full log — what it
  fetched, what it promoted or rejected and why, what portraits it added.
  Nothing it does is silent.
- **Every change lands as a normal commit** to `main` — `git log` shows
  exactly what files it touched on any given run, same as any other
  commit.
- **To pause it**: disable the workflow from the Actions tab (or comment
  out the `schedule:` trigger and push) — `workflow_dispatch` still lets
  you fire it by hand while it's otherwise paused.
- **To undo a specific decision it made**: same tools as any manual
  mistake — `npm run review -- reject <id>` / archive a bad `works` row
  (see "Database changes" above) for a bad promotion;
  `update authors set portrait_url = null where name = '...'` for a bad
  portrait (it'll fall back to the generated initial mark immediately, no
  commit needed either way — see "Author portraits" in README.md).
- **If it stops running or starts failing**: GitHub emails the repo's
  owner on workflow failure by default — no separate alerting needed. The
  most common cause is one of its two secrets (`DATABASE_URL`,
  `ANTHROPIC_API_KEY`) missing or expired; check
  **Settings → Secrets and variables → Actions**.

## Accounts & reviewers

See "Accounts" in `README.md` for the architecture. Operationally:

- **`AUTH_SECRET` should be set everywhere the app runs regardless** —
  generate once with `npx auth secret`. Without it, `auth()` logs a
  `MissingSecret` error on every single request (it still degrades to
  "signed out" rather than crashing anything, but the error is real and
  worth not having in the logs).
- **Setting up Google sign-in** (separately, once you actually want it
  working): create an OAuth client in Google Cloud Console (APIs &
  Services → Credentials → Create OAuth client ID → Web application), add
  `https://<your-domain>/api/auth/callback/google` (and the
  `localhost:3000` equivalent for local dev) as an authorized redirect
  URI, then set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` wherever the app
  runs (see the secrets table above). Everything else about the site,
  including anonymous reading, works with none of this configured.
- **Promoting someone to reviewer**: there's no self-service path by
  design — they sign in once (which creates their `users` row), then:
  ```bash
  psql "$DATABASE_URL" -c "update users set role = 'reviewer' where email = 'someone@example.com';"
  ```
  They'll see `/admin/review` on their next page load. `'admin'` exists as
  a role value but nothing in the app currently distinguishes it from
  `'reviewer'` — reserved for whenever that distinction is actually needed.
- **Demoting/removing a reviewer**: same `update`, back to `'reader'`.
  Deleting their `users` row entirely (`delete from users where id =
  '...'`) cascades to their `sessions`/`accounts`/`reading_history` rows
  automatically (all declared `on delete cascade`); anything they
  recommended stays in `content_candidates` with `submitted_by` set to
  `null` (`on delete set null`) rather than disappearing.

## Secrets and environment variables

| Variable | Where it lives | Used by |
|---|---|---|
| `DATABASE_URL` | `.env.local` (local dev, gitignored) · Vercel project env vars · GitHub Actions repo secret | The app at runtime · `content-pipeline.yml` · every `npm run` pipeline script |
| `ANTHROPIC_API_KEY` | GitHub Actions repo secret only | `content-pipeline.yml`'s Claude Code agent step |
| `AUTH_SECRET` | `.env.local` · Vercel project env vars | Auth.js session/cookie signing — set this everywhere regardless of whether sign-in is configured yet; generate with `npx auth secret` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | `.env.local` · Vercel project env vars | Sign-in (`lib/auth.ts`) — genuinely optional; the app runs fine without these, sign-in just won't work |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL` | `.env.local` · Vercel project env vars · GitHub Actions repo secrets (so `content-pipeline.yml` can publish real portraits) | Author-portrait storage — genuinely optional; without it every author just shows a generated initial instead of a real photo, nothing errors |

If the Neon connection string ever changes (new project, rotated
credentials, moved to a different region), it has to be updated
everywhere it's listed above (local, Vercel, and — for `DATABASE_URL`
specifically — GitHub Actions too) — nothing propagates automatically
between them. `.env.local.example` documents the shape of every variable
above for local setup; it's never itself a real secret (no real value is
committed).

## Moving or re-platforming

Nothing here is tied to a specific host besides the three SaaS pieces
(Neon, Vercel, R2), and all three are swappable independently of each
other and of the code:

- **Moving the database**: create a new Neon (or any Postgres) project,
  apply the migrations in order, run `npm run seed`, update
  `DATABASE_URL` everywhere (see the table above). The app has no other
  database-specific code — `lib/db.ts` is a single `neon(url)` call.
- **Moving off Vercel**: `next.config.ts` has no Vercel-specific
  configuration (no adapters, no `output: "export"` or platform-specific
  options) — `npm run build && npm run start` is a plain Next.js server
  that runs anywhere Node runs (a container, a VM, another PaaS). The only
  thing to carry over is the env vars at runtime.
- **Moving off R2**: `lib/r2.ts` is a plain `@aws-sdk/client-s3` client
  pointed at R2's S3-compatible endpoint — any S3-compatible store (actual
  S3, Backblaze B2, MinIO self-hosted) works by changing the endpoint URL
  and swapping `R2_*` for that provider's credentials. Nothing else in the
  app knows or cares where portrait images physically live; it only ever
  reads `authors.portrait_url`, a plain URL string.
- **Moving the GitHub repo** (new org, new owner, a fork): update the
  `origin` remote locally, and re-add both repo secrets on the new
  repo — GitHub Actions secrets don't transfer with a repo transfer/fork.
  `content-pipeline.yml`'s `sources[].git_repository.url` (if you ever
  wire this pipeline through anything other than GitHub Actions itself)
  and the README's `github.com/PaulLin1/oneoneone` references are the only
  places the repo URL is hardcoded — a quick grep for that string finds
  everything.

## Troubleshooting

- **Site loads but shows a stale day number**: almost always a
  `localStorage` cache issue on the reader's end, not a server bug — see
  the comment on `STORAGE_KEY` in `lib/local-state/schema.ts` for why (this
  happened once already, after the epoch was reset — the key was bumped to
  force a clean cache miss for everyone).
- **First load after a while is slow / shows "waking up"**: expected —
  Neon's serverless Postgres suspends after idle and pays a cold-start
  penalty on the next query. Handled in `lib/local-state/useLocalState.ts`;
  not a bug.
- **`next build` fails on Vercel but passes locally**: check the Vercel
  build log for the actual error first — a missing env var only ever shows
  up at runtime (see the note in the README's "Deploy to Vercel" section),
  so a build-time failure is something else, most likely a dependency or
  Node-version mismatch. Vercel's Node version can be pinned in
  **Settings → General → Node.js Version** if it drifts from what's tested
  locally/in CI (currently Node 20, per `ci.yml`).
- **A GitHub Action secret needs rotating**: update it in
  **Settings → Secrets and variables → Actions** — no code or workflow
  change needed, the workflows just read `secrets.X` by name.
