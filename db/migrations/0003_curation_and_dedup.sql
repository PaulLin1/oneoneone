-- Closes concrete gaps in the content pipeline found during a curation-
-- automation review:
--
-- 1. `promote-candidate.ts` hardcoded `public_domain = true` on every work,
--    regardless of whether that was ever actually checked. `rights_status`
--    replaces that with a real, reviewable status (see lib/rights.ts for the
--    computation); `public_domain` becomes a generated column derived from
--    it, so the two can never drift apart again, and every existing query
--    reading `public_domain` (e.g. ReadingView's "Public domain" footer note)
--    keeps working unchanged.
-- 2. `content_candidates` had no unique constraint on `source_url` and no
--    dedup check against `works` at all — `load-candidates.ts` could
--    re-stage an already-promoted source. Title/author dedup was exact-match
--    only ("The Tyger" vs "The Tiger" would slip through) — pg_trgm gives
--    fetch-candidates.ts and load-candidates.ts a fuzzy check to run before
--    inserting.
-- 3. `era`/`difficulty`/`region` are stored but were never indexed — cheap
--    to add now, needed once selection actually balances on them.
-- 4. `source_tier` lets ingestion flag how much a source is trusted
--    (Standard Ebooks' cleaned text vs. Gutenberg/Wikisource's mixed OCR vs.
--    Internet Archive's raw OCR) so reviewers know to scrutinize harder.

create extension if not exists pg_trgm;

create index works_title_trgm_idx on works using gin (title gin_trgm_ops);
create index content_candidates_title_trgm_idx on content_candidates using gin (title gin_trgm_ops);

alter table content_candidates
  add constraint content_candidates_source_url_key unique (source_url);

create index works_era_idx on works (era);
create index works_difficulty_idx on works (difficulty);
create index works_region_idx on works (region);

alter table content_candidates
  add column rights_status text not null default 'unverified'
    check (rights_status in ('public_domain', 'licensed', 'unverified'));

alter table content_candidates
  add column source_tier text not null default 'standard'
    check (source_tier in ('high_trust', 'standard', 'ocr_unverified'));

-- Replace the hardcoded boolean with a real status column, then make
-- `public_domain` a generated mirror of it instead of dropping it — nothing
-- downstream (works_feed, ReadingView) has to change. works_feed selects
-- w.public_domain by name, so it has to be dropped and recreated around the
-- column swap (Postgres won't let you drop a column a view depends on).
drop view works_feed;

alter table works
  add column rights_status text not null default 'public_domain'
    check (rights_status in ('public_domain', 'licensed', 'unverified'));

alter table works drop column public_domain;
alter table works
  add column public_domain boolean generated always as (rights_status = 'public_domain') stored;

create view works_feed as
select
  w.id,
  w.title,
  a.name as author,
  a.bio as author_note,
  w.year,
  w.category,
  w.text_content,
  w.description,
  w.source_name,
  w.source_url,
  w.public_domain,
  w.difficulty,
  w.reading_minutes,
  w.era,
  w.region,
  coalesce(
    array_agg(t.slug order by t.slug) filter (where t.slug is not null),
    '{}'
  ) as tags,
  (w.status = 'approved') as is_active,
  w.created_at
from works w
join authors a on a.id = w.author_id
left join work_tags wt on wt.work_id = w.id
left join tags t on t.id = wt.tag_id
group by w.id, a.id;
