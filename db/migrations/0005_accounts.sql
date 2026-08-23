-- Accounts are opt-in, and additive to everything that already exists.
-- Anonymous reading (the only mode before this migration, and still the
-- default) touches none of these tables — see "Accounts" in README.md.
--
-- users/accounts/sessions/verification_token: the exact shape
-- @auth/neon-adapter expects (verified against its source, not just the
-- generic Auth.js docs, including the column casing and the *singular*
-- "verification_token" table name).

create table users (
  id              uuid primary key default gen_random_uuid(),
  name            text,
  email           text unique,
  "emailVerified" timestamptz,
  image           text,
  -- 'reviewer'/'admin' are for the manual-review UI (see 0006) — everyone
  -- signs up as a plain 'reader'; promoting someone to reviewer is a
  -- deliberate hand-edit, never a self-service signup option.
  role            text not null default 'reader'
    check (role in ('reader', 'reviewer', 'admin')),
  created_at      timestamptz not null default now()
);

create table accounts (
  id                  uuid primary key default gen_random_uuid(),
  "userId"            uuid not null references users(id) on delete cascade,
  type                text not null,
  provider            text not null,
  "providerAccountId" text not null,
  refresh_token       text,
  access_token        text,
  expires_at          bigint,
  token_type          text,
  scope               text,
  id_token            text,
  session_state       text,
  unique (provider, "providerAccountId")
);

create table sessions (
  id             uuid primary key default gen_random_uuid(),
  "sessionToken" text not null unique,
  "userId"       uuid not null references users(id) on delete cascade,
  expires        timestamptz not null
);

create table verification_token (
  identifier text not null,
  expires    timestamptz not null,
  token      text not null,
  primary key (identifier, token)
);

-- Reading history: exists only for signed-in readers. Upsert-friendly
-- (unique per user+work) since re-reading something shouldn't duplicate,
-- and read_at tracks the most recent read via `on conflict do update`,
-- not the first.
create table reading_history (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  work_id uuid not null references works(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (user_id, work_id)
);

create index reading_history_user_idx on reading_history (user_id, read_at desc);

-- Recommendations feed the existing review queue: content_candidates
-- already had origin='user_submitted' + submitted_by reserved for exactly
-- this (see 0002), unused until now. source_url becomes nullable because a
-- casual recommendation may not come with one yet — scripts/promote-
-- candidate.ts is updated alongside this migration to refuse promotion
-- without one, the same way it already refuses without text_content.
-- submitted_by upgrades from loose text to a real FK now that real user
-- ids exist to reference (safe: no row has ever had this column set).
alter table content_candidates alter column source_url drop not null;
alter table content_candidates
  alter column submitted_by type uuid using submitted_by::uuid;
alter table content_candidates
  add constraint content_candidates_submitted_by_fkey
    foreign key (submitted_by) references users(id) on delete set null;
