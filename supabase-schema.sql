-- ════════════════════════════════════════════════════════════════
-- RCNK Tracker — paste ALL of this into Supabase → SQL Editor → Run.
-- Safe to run once on a fresh project.
-- ════════════════════════════════════════════════════════════════

-- The two people (fixed).
create table if not exists profiles (
  id   text primary key,
  name text not null
);
insert into profiles (id, name) values
  ('rukmini', 'Rukmini'),
  ('nikhil',  'Nikhil')
on conflict (id) do nothing;

-- One push subscription per person (their phone).
create table if not exists push_subscriptions (
  person_id    text primary key references profiles(id),
  subscription jsonb not null,
  updated_at   timestamptz not null default now()
);

-- Tasks.
create table if not exists tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  notes         text,
  assignee      text not null references profiles(id),   -- who must do it
  created_by    text not null references profiles(id),   -- who assigned it
  due_at        timestamptz,                             -- optional deadline
  done          boolean not null default false,
  done_at       timestamptz,
  remark        text,                                    -- required note written when completing
  created_at    timestamptz not null default now()
);

-- safe to re-run: adds the remark column if you set this up earlier without it
alter table tasks add column if not exists remark text;

create index if not exists tasks_assignee_idx on tasks (assignee);
create index if not exists tasks_due_idx on tasks (due_at);

-- Live sync (both phones update instantly).
alter publication supabase_realtime add table tasks;

-- ── Access ──────────────────────────────────────────────────────
-- This app has no per-user login (it's gated by one shared password
-- in the browser), so we let the public "anon" key read/write these
-- three tables. Fine for a private two-person tool. Don't store
-- anything sensitive here.
alter table profiles            enable row level security;
alter table tasks               enable row level security;
alter table push_subscriptions  enable row level security;

drop policy if exists "anon read profiles" on profiles;
create policy "anon read profiles" on profiles
  for select to anon using (true);

drop policy if exists "anon all tasks" on tasks;
create policy "anon all tasks" on tasks
  for all to anon using (true) with check (true);

drop policy if exists "anon all subs" on push_subscriptions;
create policy "anon all subs" on push_subscriptions
  for all to anon using (true) with check (true);
