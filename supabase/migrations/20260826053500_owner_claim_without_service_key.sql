-- One-time, authenticated owner claim. The bootstrap token is stored only as
-- a SHA-256 digest and is permanently consumed after the first owner claim.

create table if not exists public.admin_setup_config (
  singleton boolean primary key default true check (singleton),
  token_hash bytea not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.admin_setup_config enable row level security;
revoke all on table public.admin_setup_config from public, anon, authenticated;

create or replace function public.claim_admin_owner(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  expected_hash bytea;
begin
  if caller_id is null or length(p_token) < 16 then
    return false;
  end if;

  if exists (select 1 from public.admin_owner) then
    return false;
  end if;

  select token_hash into expected_hash
  from public.admin_setup_config
  where singleton and consumed_at is null
  for update;

  if expected_hash is null or extensions.digest(p_token, 'sha256') <> expected_hash then
    return false;
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
  where id = caller_id;

  insert into public.admin_owner(singleton, user_id) values (true, caller_id);
  update public.admin_setup_config set consumed_at = now() where singleton;

  insert into public.audit_log(actor_id, action, entity_type, entity_id)
  values (caller_id, 'admin_owner_created', 'admin_owner', caller_id);

  return true;
end;
$$;

revoke all on function public.claim_admin_owner(text) from public, anon;
grant execute on function public.claim_admin_owner(text) to authenticated;
