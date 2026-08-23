-- Moves portrait display off a hand-maintained TypeScript Set + git-
-- committed PNGs (lib/authorPortraits.ts's AUTHORS_WITH_PORTRAIT) onto the
-- database: authors.portrait_url is the public R2 URL of the final,
-- processed flat black-and-white image, or null if that author doesn't
-- have a good one yet. This is what actually makes the reviewer UI
-- (app/admin/review) and the scheduled agent able to add/replace a
-- portrait with a plain UPDATE + an R2 upload — no code change, no git
-- commit, no redeploy needed just to add one author's picture.
--
-- Distinct from portrait_source_url (added in 0004): that's provenance —
-- where the raw image was fetched from. This is the finished asset that
-- actually gets served.
--
-- create or replace view is enough here (not drop+recreate like 0003
-- needed) because this only appends a new trailing column — every
-- existing column stays exactly as it was, so nothing that already reads
-- works_feed has to change.

alter table authors add column if not exists portrait_url text;

-- author_portrait_url has to go at the very end of the column list:
-- `create or replace view` only allows *appending* new trailing columns,
-- not inserting one in the middle — Postgres errors on that (it would
-- shift every positional column after it).
create or replace view works_feed as
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
  w.created_at,
  a.portrait_url as author_portrait_url
from works w
join authors a on a.id = w.author_id
left join work_tags wt on wt.work_id = w.id
left join tags t on t.id = wt.tag_id
group by w.id, a.id;
