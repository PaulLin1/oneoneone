-- The site no longer walks a deterministic rotation over a fixed catalogue
-- (lib/selection/algorithm.ts, seed/works.json — both removed). Instead the
-- automated daily pipeline discovers three genuinely new public-domain works
-- each day (one poem, one essay, one story), promotes them live, and pins
-- them to that calendar date here. This table IS the record of "what ran on
-- day N" — the home page reads today's row set, the Archive reads every
-- past date's.
--
-- (pick_date, category) is the primary key: exactly one official work per
-- category per day, and re-running the pipeline for a date overwrites rather
-- than duplicates (see scripts/add-daily.ts's ON CONFLICT). work_id has no
-- ON DELETE clause on purpose — archiving a bad work (status = 'archived')
-- already pulls it from works_feed, so the daily-selection join drops it and
-- the day reads as "not published yet" until add-daily is re-run for it.

create table daily_picks (
  pick_date  date not null,
  category   work_category not null,
  work_id    uuid not null references works(id),
  created_at timestamptz not null default now(),
  primary key (pick_date, category)
);

create index daily_picks_date_idx on daily_picks (pick_date);
