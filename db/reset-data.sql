-- Wipes ALL data — every account, session, reading history row, review
-- queue entry, and the entire catalog (works/authors/tags). Schema and
-- migrations are untouched; this only empties tables that already exist.
--
-- Not reversible except via a Neon point-in-time restore. Run this
-- yourself against production (psql or the Neon SQL Editor) — nothing in
-- this repo runs it automatically.
--
-- After this runs, the catalog is empty. Repopulate it by hand:
--   npm run fetch-candidates -- N   (stages candidates, nothing goes live)
--   npm run review                  (list, show, edit, promote/reject each one)
-- Nothing auto-promotes — see README.md's "Content pipeline" section.
--
-- Also note: this does not touch anything in R2 (author portrait image
-- files). authors.portrait_url references are gone once `authors` is
-- truncated, but the actual uploaded images stay in the bucket, orphaned
-- but harmless. Delete them from the R2 dashboard separately if you want
-- storage back.

truncate table
  reading_history,
  content_candidates,
  work_tags,
  works,
  tags,
  authors,
  sessions,
  accounts,
  verification_token,
  users
cascade;
