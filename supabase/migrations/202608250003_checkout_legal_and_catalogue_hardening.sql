revoke all on public.products from anon, authenticated;
grant select (id,sku,category_slug,status,base_currency,production_days_min,production_days_max,approved_image_path,gallery,personalized,created_at,updated_at) on public.products to anon, authenticated;

create table if not exists public.required_legal_document_types (
  code text primary key,
  required_at_checkout boolean not null default true,
  sort_order integer not null default 100
);
insert into public.required_legal_document_types(code,sort_order) values ('terms',10),('shipping',20),('withdrawal',30),('complaints',40),('privacy',50),('cookies',60),('company',70) on conflict(code) do update set sort_order=excluded.sort_order;
alter table public.required_legal_document_types enable row level security;
create policy "required legal types read" on public.required_legal_document_types for select using (true);
create policy "admin required legal access" on public.required_legal_document_types for all using (public.is_admin()) with check (public.is_admin());

alter table public.orders add column if not exists legal_snapshot jsonb not null default '[]'::jsonb;
alter table public.stripe_events add column if not exists updated_at timestamptz not null default now();

create or replace function public.protect_published_legal_version() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'published' and old.approved_at is not null then raise exception 'Approved legal versions are immutable; create a new version'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists protect_published_legal on public.legal_documents;
create trigger protect_published_legal before update or delete on public.legal_documents for each row execute function public.protect_published_legal_version();
revoke execute on function public.protect_published_legal_version() from public, anon, authenticated;
