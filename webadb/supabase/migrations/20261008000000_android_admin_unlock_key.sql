-- Give approved YiDream administrators access to a shared, server-held Android unlock key.
-- The key is generated once, stored outside exposed schemas, and returned only by an admin-checked RPC.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.android_unlock_keys (
  singleton boolean primary key default true check (singleton),
  intermediate_key bytea not null,
  created_at timestamptz not null default now()
);
revoke all on private.android_unlock_keys from public, anon, authenticated;

insert into private.android_unlock_keys (singleton, intermediate_key)
values (true, extensions.gen_random_bytes(32))
on conflict (singleton) do nothing;

create or replace function public.get_android_unlock_material()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_key bytea;
  utc_date text;
  code_hex text;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Un accès administrateur approuvé est requis.';
  end if;

  select intermediate_key into secret_key
  from private.android_unlock_keys
  where singleton = true;

  if secret_key is null then
    raise exception 'La clé Android sécurisée n’est pas initialisée.';
  end if;

  utc_date := to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
  code_hex := upper(substr(encode(extensions.hmac(convert_to(utc_date, 'UTF8'), secret_key, 'sha256'), 'hex'), 1, 6));

  return jsonb_build_object(
    'intermediate_key', encode(secret_key, 'base64'),
    'code', code_hex,
    'date', utc_date
  );
end;
$$;

revoke all on function public.get_android_unlock_material() from public, anon;
grant execute on function public.get_android_unlock_material() to authenticated;
