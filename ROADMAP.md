# Roadmap

Ideas that are deliberately *not* built yet — specced here so a future pass
doesn't have to re-derive the design, and so "not built" doesn't quietly
become "forgotten." Nothing in this file changes today's behavior.

## Licensed content

The daily pull (`scripts/add-daily.ts`, `scripts/promote-candidate.ts`,
`lib/rights.ts`) is public-domain-only, permanently, by design — see
`rights_status` on `works`/`content_candidates`
(`db/migrations/0003_curation_and_dedup.sql`). That's a real limit: Bradbury
names Roald Dahl (d. 1990), Aldous Huxley (d. 1963), and Loren Eiseley
(d. 1977) as reading-list authors, and none of them are public domain. The
pipeline sources PD writers in the same spirit instead — T. H. Huxley,
Poe/Hawthorne/Melville/Saki for metaphor-dense short fiction, etc. — rather
than pretending the actual named authors are reachable through automation.

`rights_status` already allows a `'licensed'` value, unused today. If a real
licensing arrangement ever exists for specific non-PD works, that's how it
would be represented — added by hand with `add-daily --force-pd` after the
call is made explicitly, never on the strength of the year math alone.

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

`era`, `difficulty`, and `region` are stored on every work and indexed
(`0003_curation_and_dedup.sql`). The daily pipeline is *told* to favour
variety across consecutive days (see the prompt in `content-pipeline.yml`
and the quality bar in `seed/README.md`), but nothing enforces it — a run
that picks three 19th-century English essays in a row would go through.

Worth adding a hard check to `scripts/add-daily.ts`: before pinning, look at
the last ~5 days of `daily_picks` for that category and refuse (or warn) on
the same `era`/`region` landing three days running. Cheap, and it makes the
"favour variety" instruction real instead of advisory.

## Guest / celebrity curators

Mostly free now: `daily_picks` already *is* a `(date, category) → work`
schedule, and a human can fill a future date by hand with `npm run add-daily`
before the pipeline gets to it (`recordDailyPick`'s upsert means whoever runs
last wins — so a scheduled guest pick would need the pipeline taught to skip
a date that's already fully pinned).

What's actually missing is attribution: a `curators` table (`id`, `name`,
`bio`, `is_active`) and a nullable `curator_id` on `daily_picks`, plus a line
in the reading view crediting the pick. Additive, no change to the read path
for the normal (uncredited) case.

## Content-sensitivity policy

Explicitly decided, not deferred: no schema field, no promote-time
checklist, no code. Older public-domain texts that reflect period-typical
attitudes are not excluded or flagged — it's purely reviewer judgment at
`npm run review -- promote`, same as everything else that reaches `works`.
That judgment is now the daily pipeline's scheduled agent
(`content-pipeline.yml`) picking what to publish rather than a person at a
terminal — same absence of a special-cased checklist, still no code carving
out an exception for this.

## Wikisource scanned-page transclusion (a finding, not a plan)

Worth recording: Wikisource pages built from scanned-page transclusion
(`<pages index="..." from=X to=Y />`) don't yield clean text to a plain
fetch or the MediaWiki plaintext-extracts API — the daily pipeline is told
to skip them (see the workflow prompt and `seed/README.md`), which quietly
rules out some strong candidates (Poe's "The Fall of the House of Usher,"
Chekhov's "The Bet," Tennyson's "Ulysses" all have this shape on Wikisource)
on mechanics, not quality. The agent doing discovery can still extract a
transcluded work by reading the underlying `Page:` namespace pages by hand
when a work is only available that way and clearly worth it — it's a
should-skip, not a can't.
