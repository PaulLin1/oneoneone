-- 'daily' means "the one official pick for this (category, day)" — but
-- nothing enforced that, and selectDailyWorks() is recomputed fresh from
-- the *currently* active catalog on every request. If the active-works
-- set changes between two visits on the same calendar day (a work getting
-- approved/rejected, say), a reader could genuinely get a different work
-- back both times, and both got logged as 'daily' side by side — visibly
-- nonsensical on /account, since only one work can actually be that day's
-- pick.
--
-- Existing duplicates: the most recently read row per slot keeps 'daily'
-- (closest to *now's* actual canonical pick); any older same-slot 'daily'
-- row is downgraded to 'random' rather than deleted — the read genuinely
-- happened, it's just no longer mislabeled as the day's one official pick.

with ranked as (
  select id, row_number() over (
    partition by user_id, category, read_date
    order by read_at desc
  ) as rn
  from reading_history
  where source = 'daily'
)
update reading_history
set source = 'random'
where id in (select id from ranked where rn > 1);

-- Going forward: a fresh 'daily' read now replaces whichever work was
-- previously logged as that day's pick (see app/api/reading-history/
-- route.ts) instead of sitting beside it as a second "daily".
create unique index reading_history_daily_slot_key
  on reading_history (user_id, category, read_date)
  where source = 'daily';
