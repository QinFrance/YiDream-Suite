-- YiDream Suite owner and administrator access, applications, and device preparation.
-- Run after 20261006000000_reseller_admin.sql.
-- Bootstrap the owner once from the Supabase SQL editor; see SETUP.md.
create extension if not exists pgcrypto;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  email text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.admin_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_name text not null,
  email text not null default '',
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
create unique index if not exists admin_applications_one_pending_per_user
  on public.admin_applications(user_id) where status = 'pending';

alter table public.devices
  add column if not exists configuration_status text not null default 'needs_configuration'
    check (configuration_status in ('needs_configuration', 'configured')),
  add column if not exists configured_by uuid references auth.users(id) on delete set null,
  add column if not exists configured_at timestamptz;

alter table public.platform_admins enable row level security;
alter table public.admin_applications enable row level security;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = (select auth.uid()) and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = (select auth.uid()) and role = 'owner'
  );
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_platform_owner() from public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_platform_owner() to authenticated;
revoke all on public.platform_admins, public.admin_applications from anon;
grant select, insert, update, delete on public.platform_admins, public.admin_applications to authenticated;

drop policy if exists "reseller owns own profile" on public.reseller_profiles;
drop policy if exists "reseller owns own clients" on public.clients;
drop policy if exists "reseller owns own devices" on public.devices;
drop policy if exists "reseller owns own activity" on public.activity_logs;

create policy "profile visible to account or owner"
  on public.reseller_profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_owner());
create policy "owner manages stores"
  on public.reseller_profiles for all to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy "clients visible to approved store or owner"
  on public.clients for select to authenticated
  using (public.is_platform_owner() or (user_id = (select auth.uid()) and public.is_platform_admin()));
create policy "approved store or owner creates clients"
  on public.clients for insert to authenticated
  with check (public.is_platform_owner() or (user_id = (select auth.uid()) and public.is_platform_admin()));
create policy "approved store or owner updates clients"
  on public.clients for update to authenticated
  using (public.is_platform_owner() or (user_id = (select auth.uid()) and public.is_platform_admin()))
  with check (public.is_platform_owner() or (user_id = (select auth.uid()) and public.is_platform_admin()));
create policy "approved store or owner deletes clients"
  on public.clients for delete to authenticated
  using (public.is_platform_owner() or (user_id = (select auth.uid()) and public.is_platform_admin()));

create policy "devices visible to approved store or owner"
  on public.devices for select to authenticated
  using (public.is_platform_owner() or (user_id = (select auth.uid()) and public.is_platform_admin()));
create policy "approved store creates unconfigured devices"
  on public.devices for insert to authenticated
  with check (
    public.is_platform_owner()
    or (user_id = (select auth.uid()) and public.is_platform_admin()
      and configuration_status = 'needs_configuration'
      and configured_by is null and configured_at is null)
  );
create policy "approved store or owner updates device details"
  on public.devices for update to authenticated
  using (public.is_platform_owner() or (user_id = (select auth.uid()) and public.is_platform_admin()))
  with check (public.is_platform_owner() or (user_id = (select auth.uid()) and public.is_platform_admin()
      and configuration_status = 'needs_configuration'
      and configured_by is null and configured_at is null));
create policy "approved store or owner deletes devices"
  on public.devices for delete to authenticated
  using (public.is_platform_owner() or (user_id = (select auth.uid()) and public.is_platform_admin()));

create policy "activity visible to approved account or owner"
  on public.activity_logs for select to authenticated
  using (public.is_platform_owner() or (user_id = (select auth.uid()) and public.is_platform_admin()));
create policy "approved account or owner adds activity"
  on public.activity_logs for insert to authenticated
  with check (public.is_platform_owner() or (user_id = (select auth.uid()) and public.is_platform_admin()));

create policy "account reads own application or platform admin reads all"
  on public.admin_applications for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_owner());
create policy "account submits own application"
  on public.admin_applications for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

create policy "admins read roles, owner manages roles"
  on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_owner());
create policy "owner adds administrators"
  on public.platform_admins for insert to authenticated
  with check (public.is_platform_owner() and role = 'admin' and user_id <> (select auth.uid()));
create policy "owner changes administrators"
  on public.platform_admins for update to authenticated
  using (public.is_platform_owner() and role = 'admin' and user_id <> (select auth.uid()))
  with check (public.is_platform_owner() and role = 'admin' and user_id <> (select auth.uid()));
create policy "owner removes administrators"
  on public.platform_admins for delete to authenticated
  using (public.is_platform_owner() and role = 'admin' and user_id <> (select auth.uid()));

create or replace function public.review_admin_application(application_id uuid, approve boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  application public.admin_applications%rowtype;
  account_email text;
begin
  if not public.is_platform_owner() then
    raise exception 'Seul le propriétaire YiDream peut traiter les candidatures.';
  end if;

  select * into application
  from public.admin_applications
  where id = application_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Cette candidature est introuvable ou a déjà été traitée.';
  end if;

  if approve then
    select email into account_email from auth.users where id = application.user_id;
    insert into public.reseller_profiles(user_id, shop_name, email)
    values (application.user_id, application.store_name, coalesce(account_email, ''))
    on conflict (user_id) do update set shop_name = excluded.shop_name, email = excluded.email, updated_at = now();

    insert into public.platform_admins(user_id, role, email, created_by)
    values (application.user_id, 'admin', coalesce(account_email, ''), auth.uid())
    on conflict (user_id) do update set role = 'admin', email = excluded.email;

    update public.admin_applications
    set status = 'approved', email = coalesce(account_email, ''), reviewed_at = now(), reviewed_by = auth.uid()
    where id = application.id;
  else
    update public.admin_applications
    set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
    where id = application.id;
  end if;
end;
$$;

create or replace function public.set_platform_admin(target_user_id uuid, make_admin boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_platform_owner() then
    raise exception 'Seul le propriétaire YiDream peut gérer les administrateurs.';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Le propriétaire ne peut pas retirer son propre accès.';
  end if;

  if make_admin then
    insert into public.platform_admins(user_id, role, email, created_by)
    select target_user_id, 'admin', coalesce(email, ''), auth.uid() from auth.users where id = target_user_id
    on conflict (user_id) do update set role = 'admin', email = excluded.email, created_by = auth.uid();
  else
    delete from public.platform_admins where user_id = target_user_id and role = 'admin';
  end if;
end;
$$;

create or replace function public.set_device_configured(target_device_id uuid, is_configured boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_platform_owner() then
    raise exception 'Seul le propriétaire YiDream peut valider la configuration.';
  end if;

  update public.devices
  set configuration_status = case when is_configured then 'configured' else 'needs_configuration' end,
      configured_by = case when is_configured then auth.uid() else null end,
      configured_at = case when is_configured then now() else null end
  where id = target_device_id;

  if not found then
    raise exception 'Appareil introuvable.';
  end if;
end;
$$;


-- Protect the configuration attestation from direct edits by store admins.
create or replace function public.guard_device_configuration()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.configuration_status = 'configured' and not public.is_platform_owner() then
      raise exception 'Seul le propriétaire YiDream peut valider la configuration.';
    end if;
  elsif (new.configuration_status is distinct from old.configuration_status
      or new.configured_by is distinct from old.configured_by
      or new.configured_at is distinct from old.configured_at)
      and not public.is_platform_owner() then
    raise exception 'Seul le propriétaire YiDream peut modifier la validation de configuration.';
  end if;
  return new;
end;
$$;
drop trigger if exists devices_guard_configuration on public.devices;
create trigger devices_guard_configuration
before insert or update on public.devices
for each row execute function public.guard_device_configuration();

grant execute on function public.review_admin_application(uuid, boolean) to authenticated;
grant execute on function public.set_platform_admin(uuid, boolean) to authenticated;
grant execute on function public.set_device_configured(uuid, boolean) to authenticated;
