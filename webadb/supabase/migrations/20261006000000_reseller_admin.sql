-- YiDream Suite reseller tenancy. Apply this migration in the Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.reseller_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shop_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  group_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  platform text not null check (platform in ('Android','iOS','macOS','Windows','Other')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

alter table public.reseller_profiles enable row level security;
alter table public.clients enable row level security;
alter table public.devices enable row level security;
alter table public.activity_logs enable row level security;

revoke all on public.reseller_profiles, public.clients, public.devices, public.activity_logs from anon;
grant select, insert, update, delete on public.reseller_profiles, public.clients, public.devices, public.activity_logs to authenticated;
grant usage, select on sequence public.activity_logs_id_seq to authenticated;

create policy "reseller owns own profile" on public.reseller_profiles
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "reseller owns own clients" on public.clients
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "reseller owns own devices" on public.devices
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "reseller owns own activity" on public.activity_logs
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
