drop policy if exists "public settings read" on public.shop_settings;
create policy "public settings read" on public.shop_settings for select using (key in ('default_locale','fallback_locale','default_market','default_currency','gross_margin_percent','support_email','launch_ready'));

create table if not exists public.service_rate_limits (
  key_hash text not null,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (key_hash, action, window_start)
);
alter table public.service_rate_limits enable row level security;
drop policy if exists "service role rate limit access" on public.service_rate_limits;
create policy "service role rate limit access" on public.service_rate_limits for all to service_role using (true) with check (true);

create or replace function public.consume_service_rate_limit(p_key_hash text, p_action text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_window timestamptz; current_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 or length(p_key_hash) <> 64 or length(p_action) > 80 then return false; end if;
  current_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.service_rate_limits(key_hash,action,window_start,request_count)
  values(p_key_hash,p_action,current_window,1)
  on conflict(key_hash,action,window_start) do update set request_count=public.service_rate_limits.request_count+1
  returning request_count into current_count;
  return current_count <= p_limit;
end $$;
revoke all on function public.consume_service_rate_limit(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_service_rate_limit(text,text,integer,integer) to service_role;
