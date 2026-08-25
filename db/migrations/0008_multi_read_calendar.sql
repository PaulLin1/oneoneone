-- Multiple reads per (user, category, day): reading the daily pick *and*
-- a shuffled pick (or several) on the same day now creates separate rows
-- instead of the second one silently overwriting the first in the single
-- slot 0007 gave each (user, category, day).
--
-- Each row also now records *how* it was read, so /account can show a
-- signifier instead of presenting every read as if it were that day's
-- canonical pick:
--   'daily'   — today's official pick, read unshuffled
--   'random'  — a shuffled pick, or a work opened via /work/[id]
--   'archive' — an archived day's official pick, opened after that day
--   'external'— something read outside the site entirely
--
-- read_date is (as of 0007) which calendar day this counts toward. For
-- 'archive' rows that's a behavior change back from 0007: reading archived
-- day N's pick now counts toward *today* (when you actually read it), not
-- day N — source_date carries day N's actual date instead, shown back as
-- "from <date>". Every other source leaves source_date null.

alter table reading_history drop constraint reading_history_user_id_category_read_date_key;

alter table reading_history
  add column source text not null default 'daily'
    check (source in ('daily', 'random', 'archive', 'external')),
  add column source_date date;

-- Reopening the exact same catalog work in the same category on the same
-- day still just bumps read_at instead of duplicating — but two different
-- works in that slot (the daily pick and a shuffle, say) are both real
-- rows now. Partial (work_id is not null) because external reads have no
-- natural content key to dedupe on: every "outside read" save is its own
-- row, deleted individually rather than overwritten.
create unique index reading_history_user_category_date_work_key
  on reading_history (user_id, category, read_date, work_id)
  where work_id is not null;
