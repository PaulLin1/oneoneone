# Curation rules — the daily pull

There is no seed catalogue and no rotation any more. Every day the automated
pipeline (`.github/workflows/content-pipeline.yml`) discovers three brand-new
public-domain works — one poem, one essay, one story — promotes them live,
and pins them to that date (`daily_picks`, `lib/dailyPicks.ts`). This file is
the standing spec that run follows: how a work is sourced, what clears the
rights bar, how the text is formatted, how the metadata is judged. It applies
to a hand-added work (`npm run add-daily`) exactly as much as to an automated
one.

## Sourcing rules

`text_content` is pulled **verbatim** from **Project Gutenberg**
(gutenberg.org), **Standard Ebooks** (standardebooks.org), or **Wikisource**
(wikisource.org) — nothing else, because all three vet public-domain status
themselves before publishing. Never reconstruct or paraphrase from memory:
fetch the work from its `source_url`, then clean it —

- strip HTML/wiki markup, Gutenberg's license header/footer boilerplate,
  page-scan artifacts (page numbers, running heads), footnote apparatus;
- where the source page is a "versions"/index page rather than the text
  itself, narrow to one specific edition and record *that* URL;
- skip Wikisource pages built from scanned-page transclusion
  (`<pages index=…>`) — the extraction comes out empty or garbled (see
  ROADMAP.md).

Preserve source-specific quirks rather than "correcting" them — the goal is
fidelity to the fetched document, not a modernized edition (e.g. the
Wikisource facsimile of Blake's *The Tyger* prints periods where later
anthologies use commas; keep the periods).

Never reuse a `source_url`, `title`, or `author` already in `works`.

## Public-domain cutoff

A work qualifies if **either**:

- it was **published 96 or more years ago** (the rolling U.S. term — works
  published in 1930 entered the public domain on 2026-01-01), **or**
- its **author died 70 or more years ago** (the Berne life+70 floor) — use
  this only when the publication year is genuinely unknown, and pass
  `--author-death-year` to `add-daily` so `lib/rights.ts` can check it.

This is computed, never assumed (`computeRightsStatus` in `lib/rights.ts`).
If neither clears, pick a different work — don't force it.

`year` is always the **original publication year**, never the date Gutenberg
or Wikisource posted their edition. `era` is bucketed from it:

| era | year range |
|---|---|
| `ancient` | before 1800 |
| `19th_century` | 1800–1899 |
| `early_20th_century` | 1900–1929 |
| `modern` | 1930+ (effectively unreachable under the cutoff) |

## Text formatting conventions

- **Poems**: line breaks within a stanza are single `\n`; stanza breaks are
  `\n\n`. Strip titles, bylines, line numbers, footnote markers, "public
  domain" notices — only the poem itself remains.
- **Prose** (essays, stories): paragraphs separated by `\n\n`. Keep original
  section breaks (numbered parts, etc.) as running text. Keep chapter
  epigraphs that were integral to the piece as originally published.
- Em dashes, curly quotes, and other typographic choices stay as the source
  edition had them — don't normalize.

## `reading_minutes`

`round(word_count / 200)`, minimum 1, over a plain whitespace split of the
final cleaned text. `add-daily` computes this; override with
`--reading-minutes` only if the automatic count is clearly wrong.

## Judged metadata

`description`, `tags`, `difficulty`, `era`, `region` are written/judged per
work, never copied from a source:

- **description** — 1–2 sentences, plain and specific, true to the text. No
  clichés, no back-cover-blurb language. Auto-generated (Haiku) when
  `--description` is omitted and `ANTHROPIC_API_KEY` is set; otherwise write
  it.
- **difficulty** — `easy` / `medium` / `challenging`, a subjective read on
  vocabulary, syntax, and density (Bacon's aphoristic Elizabethan prose:
  `challenging`; Frost, Saki: `easy`).
- **tags** — 2–5 lowercase thematic keywords for browsing, not exhaustive
  indexing.

## Quality bar

Favor widely taught, well-loved public-domain works over obscure ones, and
favor variety across consecutive days — different eras, regions, and authors
than the last few runs. A small stream of genuinely great readings, not a
random Gutenberg dump.
