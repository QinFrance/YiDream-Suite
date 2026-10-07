-- YiDream Suite owner and administrator access, applications, and device preparation.
-- Run after 20261006000000_reseller_admin.sql.
-- Bootstrap the owner once from the Supabase SQL editor; see SETUP.md.
create extension if not exists pgcrypto;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.admin_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_name text not null,
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

drop policy if exists "reseller owns own profile" on public.reseller_profiles;
drop policy if exists "reseller owns own clients" on public.clients;
drop policy if exists "reseller owns own devices" on public.devices;
drop policy if exists "reseller owns own activity" on public.activity_logs;

create policy "profile visible to account or platform admin"
  on public.reseller_profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_admin());
create policy "platform admins manage stores"
  on public.reseller_profiles for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "clients visible to account or platform admin"
  on public.clients for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_admin());
create policy "account or platform admin creates clients"
  on public.clients for insert to authenticated
  with check (user_id = (select auth.uid()) or public.is_platform_admin());
create policy "account or platform admin updates clients"
  on public.clients for update to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_admin())
  with check (user_id = (select auth.uid()) or public.is_platform_admin());
create policy "account or platform admin deletes clients"
  on public.clients for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_admin());

create policy "devices visible to account or platform admin"
  on public.devices for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_admin());
create policy "account creates unconfigured devices"
  on public.devices for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and configuration_status = 'needs_configuration'
      and configured_by is null and configured_at is null)
    or public.is_platform_admin()
  );
create policy "platform admins or account updates pending device details"
  on public.devices for update to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_admin())
  with check (
    public.is_platform_admin()
    or (user_id = (select auth.uid()) and configuration_status = 'needs_configuration'
      and configured_by is null and configured_at is null)
  );
create policy "account or platform admin deletes devices"
  on public.devices for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_admin());

create policy "activity visible to account or platform admin"
  on public.activity_logs for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_admin());
create policy "account or platform admin adds activity"
  on public.activity_logs for insert to authenticated
  with check (user_id = (select auth.uid()) or public.is_platform_admin());

create policy "account reads own application or platform admin reads all"
  on public.admin_applications for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_admin());
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

    insert into public.platform_admins(user_id, role, created_by)
    values (application.user_id, 'admin', auth.uid())
    on conflict (user_id) do update set role = 'admin';

    update public.admin_applications
    set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
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
    insert into public.platform_admins(user_id, role, created_by)
    values (target_user_id, 'admin', auth.uid())
    on conflict (user_id) do update set role = 'admin', created_by = auth.uid();
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

grant execute on function public.review_admin_application(uuid, boolean) to authenticated;
grant execute on function public.set_platform_admin(uuid, boolean) to authenticated;
grant execute on function public.set_device_configured(uuid, boolean) to authenticated;
