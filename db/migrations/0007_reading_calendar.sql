-- Reading history moves from "have I ever opened this work" (unique per
-- user+work, read_at = most recent open) to a GitHub-contributions-style
-- log: one slot per (user, category, day). /account renders that as a
-- calendar, and a slot's content can be replaced — with a specific catalog
-- work, a random pick from the catalog, or something read entirely outside
-- the site (typed in by hand, e.g. a poem from a physical book) — rather
-- than being permanently whatever ReadingView happened to log first.
--
-- work_id nullable + a check constraint is what makes "outside the site"
-- entries possible: those rows carry external_title/external_author and no
-- work_id, instead of a second table or a nullable-everything free-for-all.

alter table reading_history rename to reading_history_old;
-- A RENAME TABLE does not rename dependent index names — the old table
-- keeps carrying this name unless told otherwise, which would collide with
-- the identically-named index the new table creates below.
alter index reading_history_user_idx rename to reading_history_old_user_idx;

create table reading_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  category        work_category not null,
  read_date       date not null default current_date,
  work_id         uuid references works(id) on delete set null,
  external_title  text,
  external_author text,
  read_at         timestamptz not null default now(),
  unique (user_id, category, read_date),
  constraint reading_history_source_check check (
    (work_id is not null and external_title is null and external_author is null)
    or
    (work_id is null and external_title is not null)
  )
);

create index reading_history_user_idx on reading_history (user_id, read_date desc);

-- Backfill: each old (user, work) row becomes a (user, category, day) row,
-- day = the date it was read on. `distinct on` collapses same-day
-- same-category duplicates (e.g. two different poems read the same day)
-- down to the most-recently-read one *before* the insert runs — required
-- because `on conflict ... do update` errors ("cannot affect row a second
-- time") if a single insert's own rows collide with each other, not just
-- with existing rows.
insert into reading_history (user_id, category, read_date, work_id, read_at)
select distinct on (rh.user_id, w.category, rh.read_at::date)
  rh.user_id, w.category, rh.read_at::date, rh.work_id, rh.read_at
from reading_history_old rh
join works w on w.id = rh.work_id
order by rh.user_id, w.category, rh.read_at::date, rh.read_at desc;

drop table reading_history_old;
