-- Redesigns the content schema around three ideas:
--
-- 1. Normalize authors and tags instead of duplicating bio text and using a
--    raw text[] for tags — cheap now, pays off once the catalog is not 30
--    hand-typed rows.
-- 2. Give every work a publishing `status` instead of a bare boolean, so a
--    review pipeline (fetched candidates, later user submissions) has
--    somewhere to live without another migration.
-- 3. A single `content_candidates` staging table covers both cases: rows
--    landing here today come from the fetch pipeline (scripts/fetch-*.ts);
--    rows landing here in the future would come from a user-submission
--    form. Same table, same review step, same promotion path — the schema
--    doesn't need to change when that feature ships, only application code.
--
-- Clears the existing hand-seeded corpus per request — re-seed with
-- `npm run seed` after applying (same seed/works.json content, now flowing
-- through the normalized tables).

drop view if exists works_feed;
drop table if exists work_tags;
drop table if exists content_candidates;
drop table if exists works;
drop table if exists tags;
drop table if exists authors;
drop type if exists content_origin;
drop type if exists work_status;
drop type if exists work_era;
drop type if exists work_difficulty;
drop type if exists work_category;

create extension if not exists pgcrypto;

create type work_category   as enum ('poem', 'essay', 'story');
create type work_difficulty as enum ('easy', 'medium', 'challenging');
create type work_era        as enum ('ancient', '19th_century', 'early_20th_century', 'modern');
create type work_status     as enum ('draft', 'needs_review', 'approved', 'rejected', 'archived');
create type content_origin  as enum ('curated', 'fetch_pipeline', 'user_submitted');

-- Authors are reused across works; one row per author instead of a bio
-- string duplicated on every piece they wrote.
create table authors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  bio         text,               -- one-line note, shown in the reading view
  birth_year  int,
  death_year  int,
  region      text,
  created_at  timestamptz not null default now(),
  unique (name)
);

-- Tags as real rows (not a text[]) so tag membership is a normal indexed
-- join instead of a GIN array scan, and tags can carry their own metadata
-- later without another migration.
create table tags (
  id   uuid primary key default gen_random_uuid(),
  slug text not null unique
);

create table works (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  author_id       uuid not null references authors(id),
  year            int,
  category        work_category not null,
  text_content    text,
  description     text not null,
  source_name     text not null,
  source_url      text not null,
  public_domain   boolean not null default true,
  difficulty      work_difficulty not null default 'medium',
  reading_minutes int not null,
  era             work_era,
  region          text,
  status          work_status not null default 'approved',
  origin          content_origin not null default 'curated',
  submitted_by    text,           -- nullable; populated once user submissions exist
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (title, author_id)
);

create table work_tags (
  work_id uuid not null references works(id) on delete cascade,
  tag_id  uuid not null references tags(id) on delete cascade,
  primary key (work_id, tag_id)
);

create index works_category_status_idx on works (category, status);
create index work_tags_tag_idx on work_tags (tag_id);

-- Staging area for anything not yet live. Today: batches fetched from a
-- curated source pool (see scripts/fetch-candidates.ts). Later: user
-- submissions, tagged origin = 'user_submitted' with submitted_by set.
-- Nothing here is ever readable by the app — promotion into `works` is a
-- deliberate, reviewed step (scripts/promote-candidate.ts), never automatic.
create table content_candidates (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  author_name      text not null,
  year             int,
  category         work_category not null,
  text_content     text,
  description      text,
  source_name      text not null,
  source_url       text not null,
  region           text,
  tags             text[] not null default '{}',
  reading_minutes  int,
  origin           content_origin not null default 'fetch_pipeline',
  submitted_by     text,
  status           work_status not null default 'needs_review',
  reviewer_notes   text,
  promoted_work_id uuid references works(id),
  created_at       timestamptz not null default now(),
  reviewed_at      timestamptz
);

create index content_candidates_status_idx on content_candidates (status);

-- Flat, read-optimized shape matching what the app already queries — no
-- application code needs to change. is_active mirrors status = 'approved'
-- so existing `where is_active = true` queries keep working verbatim.
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
