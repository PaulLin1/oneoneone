# Roadmap

Ideas that are deliberately *not* built yet — specced here so a future pass
doesn't have to re-derive the design, and so "not built" doesn't quietly
become "forgotten." Nothing in this file changes today's behavior.

## Licensed content

The pipeline (`scripts/fetch-candidates.ts`, `scripts/load-candidates.ts`,
`scripts/promote-candidate.ts`) is public-domain-only, permanently, by
design — see `rights_status` on `works`/`content_candidates`
(`db/migrations/0003_curation_and_dedup.sql`). That's a real limit: Bradbury
names Roald Dahl (d. 1990), Aldous Huxley (d. 1963), and Loren Eiseley
(d. 1977) as reading-list authors, and none of them are public domain. The
pipeline sources PD writers in the same spirit instead — T. H. Huxley,
Poe/Hawthorne/Melville/Saki for metaphor-dense short fiction, etc. — rather
than pretending the actual named authors are reachable through automation.

`rights_status` already allows a `'licensed'` value, unused today. If a real
licensing arrangement ever exists for specific non-PD works, that's how it
would be represented — added by hand, one work at a time, through the same
`promote-candidate.ts` review step (never auto-promoted, never mixed into
what `fetch-candidates.ts` discovers on its own).

## Physical / external-reference "companion" mode

The idea: some days, instead of storing and serving the text at all, the app
tells you where to read in a book you already own — "Today: pages 45–52 of
*[Book Title]*." No text is ever reproduced, so this sits outside the
public-domain question entirely; it's a schedule, not a copy.

Not built. When it is:

- `works.content_mode` enum: `'full_text' | 'external_reference'`.
- For `external_reference` rows, `text_content` stays `null`; new columns
  carry `external_source_title`, `external_source_edition`,
  `external_locator` (free text — "pp. 45–52", "Poem XIV", "Chapter 3"), and
  an optional `acquisition_url` (where to buy/borrow the book — never a link
  to the full text).
- `components/ReadingView.tsx` needs a branch: when
  `content_mode = 'external_reference'`, render the locator + book info
  instead of `text_content`.
- All additive (`ALTER TABLE ... ADD COLUMN`, nullable) — no migration risk
  to today's `full_text` rows, which is why this is fine to defer rather
  than build speculatively now.

## Diversity balancing (era / difficulty / region)

`era`, `difficulty`, and `region` are stored on every work and now indexed
(`0003_curation_and_dedup.sql`), and `--era` is required at promotion time —
but `lib/selection/algorithm.ts` doesn't read any of them yet; the rotation
is purely "walk the fixed shuffle order," with no anti-clustering.

Once the pool has grown past its current size, worth adding a light check in
`rotationOrder`/`selectDailyWorks`: avoid the same `era` landing in a
category slot on consecutive days, say. Needs real `era` data across the
catalog first (which promotion now forces going forward) — not worth doing
against a ~30-works-per-category pool where it wouldn't have much to balance
against yet.

## Guest / celebrity curators

Schema sketch, not built:

```sql
create table curators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bio text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- add 'guest_curated' to the existing content_origin enum

create table scheduled_overrides (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  category work_category not null,
  work_id uuid not null references works(id),
  curator_id uuid references curators(id),
  created_at timestamptz not null default now(),
  unique (date, category)
);
```

`selectDailyWorks` would gain one pre-check: look up `scheduled_overrides`
for `(date, category)` before falling back to `rotationOrder`. On any day
without an override row (i.e. every day, until this ships and someone
schedules one), the output is byte-identical to today's — a pure additive
branch, not a change to the deterministic contract everyone else relies on.

## Content-sensitivity policy

Explicitly decided, not deferred: no schema field, no promote-time
checklist, no code. Older public-domain texts that reflect period-typical
attitudes are not excluded or flagged — it's purely reviewer judgment at
`npm run review -- promote`, same as everything else that reaches `works`.
That reviewer is now `content-pipeline.yml`'s scheduled agent rather than a
person at a terminal (see "Automation" in `README.md`) — same command, same
absence of a special-cased checklist, still no code carving out an
exception for this.

## Pool-growth bottleneck (a finding, not a plan)

Worth recording: verifying real, cleanly-extractable single-work source URLs
for `seed/source-pool.json` is the actual bottleneck, not writing more
pipeline code. Wikisource pages built from scanned-page transclusion
(`<pages index="..." from=X to=Y />`) don't yield to either the plaintext
extracts API or the `<poem>`-tag fallback in `fetch-candidates.ts` — several
strong candidates (Poe's "The Fall of the House of Usher," Chekhov's "The
Bet," Tennyson's "Ulysses") were ruled out for the *automated* pool on that
basis alone, not on quality. Two ways around it, neither built:

1. Extend `fetchFromWikisource()` to resolve `<pages index=...>` references
   by fetching the underlying `Page:` namespace pages and concatenating —
   real engineering, not just config.
2. Lean on `scripts/load-candidates.ts` (the agent-assisted path) for these
   — an agent reading the actual page can extract a transcluded work by
   hand the way the original 30-work seed catalog was built, sidestepping
   the automation gap entirely. This is no longer just a one-off manual
   fallback: `content-pipeline.yml`'s scheduled agent does exactly this
   whenever `seed/source-pool.json` runs dry, as a routine part of its run
   rather than something a person has to remember to do.
