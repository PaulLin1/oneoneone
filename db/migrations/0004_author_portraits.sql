-- Tracks where an author's portrait photo/engraving came from, mirroring
-- how works.source_url tracks text provenance. This is *source* provenance
-- only — it never becomes the image actually rendered on the site. The
-- rendered portrait is still the hand-processed, flat black-and-white
-- asset in public/authors/ (see lib/authorPortraits.ts); nothing here
-- bypasses that review step.

alter table authors
  add column portrait_source_url text;
