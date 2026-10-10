-- Aggregate anonymous YZ MDM usage counters for the YiDream owner dashboard.
-- Stores daily totals only: no user IDs, device IDs, IP addresses, or event payloads.
create table if not exists public.yz_mdm_metrics_daily (
  day date not null default (now() at time zone 'utc')::date,
  metric text not null check (metric in (
    'site_visit',
    'download_click',
    'webadb_connected',
    'launcher_installed',
    'install_failed'
  )),
  count bigint not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, metric)
);

alter table public.yz_mdm_metrics_daily enable row level security;
revoke all on public.yz_mdm_metrics_daily from anon, authenticated;
grant select on public.yz_mdm_metrics_daily to authenticated;

drop policy if exists "owner reads YZ MDM aggregate metrics" on public.yz_mdm_metrics_daily;
create policy "owner reads YZ MDM aggregate metrics"
  on public.yz_mdm_metrics_daily for select to authenticated
  using (public.is_platform_owner());

create or replace function public.record_yz_mdm_metric(p_metric text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_metric not in ('site_visit','download_click','webadb_connected','launcher_installed','install_failed') then
    raise exception 'Unsupported YZ MDM metric';
  end if;

  insert into public.yz_mdm_metrics_daily(day, metric, count, updated_at)
  values ((now() at time zone 'utc')::date, p_metric, 1, now())
  on conflict (day, metric)
  do update set count = public.yz_mdm_metrics_daily.count + 1, updated_at = now();
end;
$$;

revoke all on function public.record_yz_mdm_metric(text) from public;
grant execute on function public.record_yz_mdm_metric(text) to anon, authenticated;
