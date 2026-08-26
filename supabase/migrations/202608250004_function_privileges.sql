-- Keep trigger helpers and server-only RPCs out of the exposed PostgREST API.
create or replace function public.is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    or coalesce(auth.jwt() -> 'app_metadata' -> 'roles' ? 'admin', false)
$$;

revoke execute on function public.validate_locale_activation() from public, anon, authenticated;
revoke execute on function public.validate_product_publication() from public, anon, authenticated;
revoke execute on function public.validate_launch_ready() from public, anon, authenticated;
revoke execute on function public.protect_published_legal_version() from public, anon, authenticated;
revoke all on function public.consume_service_rate_limit(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_service_rate_limit(text,text,integer,integer) to service_role;

drop policy if exists "service role rate limit access" on public.service_rate_limits;
create policy "service role rate limit access" on public.service_rate_limits
  for all to service_role using (true) with check (true);
