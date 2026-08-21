create extension if not exists pgcrypto;

create type work_category as enum ('poem', 'essay', 'story');
create type work_difficulty as enum ('easy', 'medium', 'challenging');
create type work_era as enum ('ancient', '19th_century', 'early_20th_century', 'modern');

create table works (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  author          text not null,
  author_note     text,
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
  tags            text[] not null default '{}',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (title, author)
);

create index works_category_active_idx on works (category, is_active);
create index works_tags_gin_idx on works using gin (tags);
