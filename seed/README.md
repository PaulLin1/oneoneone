# Seed catalog — 1,000 Days

This directory contains the hand-curated launch catalog for the app: 30 public-domain
poems, essays, and short stories, plus this document describing how they were chosen,
sourced, and formatted.

## Files

- `works.json` — the catalog itself, an array of work objects (see schema below).
- `README.md` — this file.

The catalog is loaded into the database with `npm run seed`, a script that upserts
rows keyed on the `(title, author)` unique constraint. That means `works.json` is the
source of truth: edit it and re-run `npm run seed` to update the live catalog,
re-running is always safe (it will not create duplicate rows for a title/author pair
already in the database).

## Sourcing rules

Every `text_content` value was pulled verbatim from **Project Gutenberg**
(gutenberg.org) or **Wikisource** (wikisource.org) — the only two sources used,
because both organizations vet public-domain status themselves before publishing a
text. Nothing here was reconstructed or paraphrased from memory: each work was
fetched from its `source_url`, then cleaned by stripping HTML/wiki markup, Gutenberg's
license header and footer boilerplate, page-scan artifacts (page numbers, running
heads), and — where the source page was a "versions" index rather than the text
itself — narrowed down to a single specific edition, which is the edition recorded in
`source_url`.

A small number of source-specific quirks were preserved rather than "corrected,"
since the goal was fidelity to the fetched document, not a modernized edition. For
example, the Wikisource facsimile transcription of Blake's *The Tyger* (from the 1826
*Songs of Innocence and of Experience*) uses periods in a few places where later
anthologies print commas — that is what the source document has, so that is what is
stored.

## Copyright / public-domain cutoff

Every work has an original publication year of **1930 or earlier**. Under the current
U.S. copyright term, works published in 1930 or earlier are in the public domain as
of 2026 (the rolling 95-years-from-publication rule). This is a hard cutoff — nothing
in `works.json` was included on the basis of "the author is long dead" alone; the
`year` field is always checked against 1930. (The one category of exception the
curation brief allowed — works explicitly released as public domain by the source
regardless of publication year, such as certain modern translations Gutenberg
distributes PD — was not needed for this catalog; every entry qualifies on the
95-year rule by itself.)

`year` is always the **original publication year** of the work (e.g. 1844 for
Emerson's "Gifts"), never the date Gutenberg or Wikisource posted their edition of it.
`era` is bucketed from that year:

| era | year range |
|---|---|
| `ancient` | before 1800 |
| `19th_century` | 1800–1899 |
| `early_20th_century` | 1900–1929 |
| `modern` | 1930+ (unused in this catalog, by design) |

## Text formatting conventions

- **Poems**: line breaks within a stanza are single `\n`; stanza breaks are `\n\n`.
  Titles, bylines, and any editorial/footnote apparatus from the source page (line
  numbers, footnote markers, "public domain" notices, etc.) were stripped — only the
  poem itself remains.
- **Prose** (essays and stories): paragraphs are separated by `\n\n`. Original
  section breaks (e.g. Bierce's "An Occurrence at Owl Creek Bridge" numbered parts
  I–III) are preserved as part of the running text. Chapter epigraphs that are
  integral to the original published piece (e.g. the Boswell/Johnson epigraph on
  Stevenson's "An Apology for Idlers", the Arthur Symons epigraph poem on Du Bois's
  "Of Our Spiritual Strivings") were kept, since they are part of the work as
  originally published.
- Em dashes, curly quotes, and other typographic choices are whatever the source
  edition used; they were not normalized.

## `reading_minutes`

Computed mechanically as `round(word_count / 200)`, with a minimum of 1. Word count
is a plain whitespace split of the final, cleaned `text_content` (so stripped
boilerplate doesn't inflate it). 200 words/minute is a standard average adult silent
reading speed; this is an estimate, not a promise.

## Metadata that was hand-written (not copied from any source)

`description`, `tags`, `difficulty`, `era`, `region`, and `author_note` were all
written by the curator for this catalog — none of it is copied from Gutenberg,
Wikisource, or any other source. `difficulty` is a subjective read on vocabulary,
syntax, and density (e.g. Bacon's aphoristic Elizabethan prose and Yeats's allusive
imagery are rated `challenging`; Frost and Saki are rated `easy`). `tags` are 2–5
lowercase thematic keywords meant to support browsing/filtering, not exhaustive
indexing.

## Catalog composition

- **12 poems** — Dickinson (×2), Frost (×2), Poe, Yeats, Blake, Whitman, Shakespeare,
  Rossetti, Shelley, Keats.
- **9 essays** — Bacon, Emerson, Thoreau, Chesterton (×2), Twain, Stevenson, Du Bois,
  Hazlitt. Lengths range from ~500 words (Bacon's "Of Studies") to ~6,000 words
  (Thoreau's "Where I Lived, and What I Lived For").
- **9 short stories** — Poe, Chopin, Gilman, Bierce, Saki, Jacobs, Maupassant,
  O. Henry, and Melville's "Bartleby, the Scrivener" as the long anchor piece
  (~14,000 words, ~72 minutes).

Selections favor widely taught, well-loved public-domain works over obscure ones —
the goal is a small but genuinely great starting shelf, not a random Gutenberg dump.

## Updating the catalog

To add or change a work:

1. Confirm it qualifies under the 1930 cutoff above.
2. Fetch the verbatim text from Gutenberg or Wikisource and clean it per the
   formatting conventions above.
3. Add/edit the entry in `works.json`, filling in `reading_minutes` as
   `round(word_count / 200)` (minimum 1).
4. Validate the file parses, e.g.:
   `node -e "JSON.parse(require('fs').readFileSync('works.json'))"`.
5. Run `npm run seed` to upsert into the database.

This file is hand-reviewed; there is no automated pipeline regenerating it, so any
edits to `works.json` should go through the same review before being seeded.

There is now a separate path for growing the catalog beyond this file — see
"Content pipeline" in the top-level `README.md`. Works added that way go through a
`content_candidates` review queue (`npm run review`) rather than straight into
`works.json`; nothing skips review regardless of how it was discovered.
