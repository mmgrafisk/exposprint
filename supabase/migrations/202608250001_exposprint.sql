create extension if not exists pgcrypto;

create type public.content_status as enum ('draft','published','archived');
create type public.product_status as enum ('draft','hidden','published','archived');
create type public.order_status as enum ('pending_payment','payment_processing','paid','artwork_review','production','shipped','completed','cancelled','payment_expired');

create table public.shop_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table public.locales (
  code text primary key check (code ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  name text not null,
  hreflang text not null,
  intl_locale text not null,
  enabled boolean not null default false,
  is_default boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index locales_one_default on public.locales (is_default) where is_default;

create table public.currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  name text not null,
  symbol text not null,
  decimals smallint not null default 2 check (decimals between 0 and 4),
  rate_from_dkk numeric(18,8) not null check (rate_from_dkk > 0),
  rounding_increment numeric(12,4) not null default .01 check (rounding_increment > 0),
  enabled boolean not null default false,
  is_default boolean not null default false,
  rate_source text not null,
  rate_updated_at timestamptz not null,
  manual_override boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index currencies_one_default on public.currencies (is_default) where is_default;

create table public.shipping_zones (
  code text primary key,
  name text not null,
  transit_days_min integer not null check (transit_days_min >= 0),
  transit_days_max integer not null check (transit_days_max >= transit_days_min),
  price_minor_dkk bigint not null default 0 check (price_minor_dkk >= 0),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  carrier text,
  enabled boolean not null default true,
  sort_order integer not null default 100
);

create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  zone_code text not null references public.shipping_zones(code) on delete cascade,
  method_id uuid not null references public.shipping_methods(id) on delete cascade,
  product_id uuid,
  min_subtotal_minor_dkk bigint,
  max_subtotal_minor_dkk bigint,
  price_minor_dkk bigint not null default 0 check (price_minor_dkk >= 0),
  enabled boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz
);

create table public.markets (
  country_code text primary key check (country_code ~ '^[A-Z]{2}$'),
  default_locale text not null references public.locales(code),
  default_currency text not null references public.currencies(code),
  vat_rate numeric(6,3) not null check (vat_rate >= 0),
  vat_zone text not null default 'EU',
  shipping_zone_code text not null references public.shipping_zones(code),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.translation_entries (
  locale text not null references public.locales(code) on delete cascade,
  namespace text not null,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (locale, namespace, key)
);

create table public.required_translation_keys (
  namespace text not null,
  key text not null,
  area text not null check (area in ('navigation','checkout','email','legal')),
  primary key (namespace, key)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  status public.content_status not null default 'draft',
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);
create table public.category_translations (
  category_id uuid not null references public.categories(id) on delete cascade,
  locale text not null references public.locales(code) on delete cascade,
  name text not null,
  description text not null default '',
  primary key (category_id, locale)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  supplier_sku text,
  category_slug text not null,
  status public.product_status not null default 'draft',
  supplier_cost_minor bigint check (supplier_cost_minor >= 0),
  base_currency text not null default 'DKK' references public.currencies(code),
  price_override_minor bigint check (price_override_minor is null or price_override_minor >= 0),
  production_days_min integer check (production_days_min >= 0),
  production_days_max integer check (production_days_max >= production_days_min),
  approved_image_path text,
  gallery jsonb not null default '[]'::jsonb,
  personalized boolean not null default true,
  source_url text,
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shipping_rates add constraint shipping_rates_product_fk foreign key (product_id) references public.products(id) on delete cascade;

create table public.product_translations (
  product_id uuid not null references public.products(id) on delete cascade,
  locale text not null references public.locales(code) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  alt_text text not null default '',
  seo_title text,
  seo_description text,
  primary key (product_id, locale),
  unique (locale, slug)
);

create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  code text not null,
  label text not null,
  type text not null check (type in ('single','multiple','number','text')),
  required boolean not null default false,
  values jsonb not null default '[]'::jsonb,
  sort_order integer not null default 100,
  unique (product_id, code)
);

create table public.product_documents (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  document_type text not null,
  locale text references public.locales(code),
  title text not null,
  storage_path text not null,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table public.closed_dates (
  id uuid primary key default gen_random_uuid(),
  closed_on date not null,
  zone_code text references public.shipping_zones(code) on delete cascade,
  reason text,
  unique (closed_on, zone_code)
);

create table public.business_profile (
  id boolean primary key default true check (id),
  company_name text,
  vat_number text,
  physical_address jsonb,
  email text,
  phone text,
  return_address jsonb,
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  locale text not null references public.locales(code) on delete cascade,
  version integer not null check (version > 0),
  status public.content_status not null default 'draft',
  title_key text not null,
  body text not null,
  effective_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  content_hash text generated always as (encode(digest(body, 'sha256'), 'hex')) stored,
  created_at timestamptz not null default now(),
  unique (document_type, locale, version)
);

create table public.required_legal_document_types (
  code text primary key,
  required_at_checkout boolean not null default true,
  sort_order integer not null default 100
);
insert into public.required_legal_document_types(code,sort_order) values ('terms',10),('shipping',20),('withdrawal',30),('complaints',40),('privacy',50),('cookies',60),('company',70);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated by default as identity unique,
  user_id uuid references auth.users(id),
  guest_access_token uuid not null default gen_random_uuid(),
  status public.order_status not null default 'pending_payment',
  locale text not null references public.locales(code),
  market_code text not null references public.markets(country_code),
  currency text not null references public.currencies(code),
  subtotal_minor bigint not null,
  shipping_minor bigint not null,
  tax_minor bigint not null,
  total_minor bigint not null,
  quote_snapshot jsonb not null,
  legal_versions jsonb not null,
  legal_snapshot jsonb not null default '[]'::jsonb,
  accepted_terms_at timestamptz not null,
  customer_email text,
  shipping_address jsonb,
  billing_details jsonb,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  adivin_reference text,
  tracking_number text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  sku text not null,
  title_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price_minor bigint not null,
  tax_minor bigint not null,
  line_total_minor bigint not null,
  configuration jsonb not null default '{}'::jsonb,
  artwork_path text,
  delivery_snapshot jsonb not null
);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.stripe_events (
  event_id text primary key,
  event_type text not null,
  payload jsonb not null,
  processing_status text not null check (processing_status in ('processing','processed','failed')),
  processing_error text,
  processed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_hash text not null unique,
  status text not null,
  rows_received integer not null default 0,
  rows_imported integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    or coalesce(auth.jwt() -> 'app_metadata' -> 'roles' ? 'admin', false)
$$;

create or replace function public.validate_locale_activation() returns trigger language plpgsql security definer set search_path = '' as $$
declare missing_count integer;
begin
  if new.enabled and not old.enabled then
    select count(*) into missing_count from public.required_translation_keys required
    where not exists (
      select 1 from public.translation_entries entry
      where entry.locale = new.code and entry.namespace = required.namespace and entry.key = required.key and length(trim(entry.value)) > 0
    );
    if missing_count > 0 then raise exception 'Locale % is missing % required translations', new.code, missing_count; end if;
    if not exists (select 1 from public.legal_documents where locale = new.code and document_type = 'terms' and status = 'published') then
      raise exception 'Locale % requires published terms', new.code;
    end if;
  end if;
  return new;
end $$;
create trigger validate_locale_before_activation before update of enabled on public.locales for each row execute function public.validate_locale_activation();

create or replace function public.validate_product_publication() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and (new.supplier_cost_minor is null or new.production_days_min is null or new.production_days_max is null or new.approved_image_path is null) then
    raise exception 'Published products require price, delivery time and approved image';
  end if;
  if new.status = 'published' and not exists (select 1 from public.product_translations where product_id = new.id) then
    raise exception 'Published products require a translation';
  end if;
  return new;
end $$;
create constraint trigger validate_product_on_publish after insert or update of status on public.products deferrable initially deferred for each row execute function public.validate_product_publication();

create or replace function public.validate_launch_ready() returns trigger language plpgsql security definer set search_path = '' as $$
declare complete_documents integer;
begin
  if new.key = 'launch_ready' and new.value = 'true'::jsonb then
    if not exists (select 1 from public.business_profile where id and company_name is not null and vat_number is not null and physical_address is not null and email is not null and phone is not null and return_address is not null and approved_at is not null) then
      raise exception 'Launch blocked: company details are incomplete';
    end if;
    select count(distinct document_type) into complete_documents from public.legal_documents where locale = 'da' and status = 'published' and approved_at is not null and document_type in ('terms','shipping','withdrawal','complaints','privacy','cookies','company');
    if complete_documents < 7 then raise exception 'Launch blocked: Danish legal documents are incomplete'; end if;
  end if;
  return new;
end $$;
create trigger validate_launch_setting before insert or update on public.shop_settings for each row execute function public.validate_launch_ready();

create or replace function public.protect_published_legal_version() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'published' and old.approved_at is not null then raise exception 'Approved legal versions are immutable; create a new version'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger protect_published_legal before update or delete on public.legal_documents for each row execute function public.protect_published_legal_version();

insert into public.required_translation_keys(namespace,key,area) values
('nav','products','navigation'),('nav','account','navigation'),('nav','cart','navigation'),
('checkout','error','checkout'),('cart','checkout','checkout'),('cart','total','checkout'),('cart','shipping','checkout'),
('email','orderSubject','email'),('legal','terms','legal');

alter table public.shop_settings enable row level security;
alter table public.locales enable row level security;
alter table public.currencies enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.shipping_methods enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.markets enable row level security;
alter table public.translation_entries enable row level security;
alter table public.required_translation_keys enable row level security;
alter table public.categories enable row level security;
alter table public.category_translations enable row level security;
alter table public.products enable row level security;
alter table public.product_translations enable row level security;
alter table public.product_options enable row level security;
alter table public.product_documents enable row level security;
alter table public.closed_dates enable row level security;
alter table public.business_profile enable row level security;
alter table public.legal_documents enable row level security;
alter table public.required_legal_document_types enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.order_status_history enable row level security;
alter table public.stripe_events enable row level security;
alter table public.import_jobs enable row level security;
alter table public.audit_log enable row level security;

create policy "public settings read" on public.shop_settings for select using (key in ('default_locale','fallback_locale','default_market','default_currency','gross_margin_percent','support_email','launch_ready'));
create policy "active locales read" on public.locales for select using (enabled);
create policy "active currencies read" on public.currencies for select using (enabled);
create policy "active zones read" on public.shipping_zones for select using (enabled);
create policy "active methods read" on public.shipping_methods for select using (enabled);
create policy "active rates read" on public.shipping_rates for select using (enabled);
create policy "active markets read" on public.markets for select using (enabled);
create policy "active translations read" on public.translation_entries for select using (exists (select 1 from public.locales where code = locale and enabled));
create policy "published categories read" on public.categories for select using (status = 'published');
create policy "published category translations read" on public.category_translations for select using (exists (select 1 from public.categories where id = category_id and status = 'published'));
create policy "published products read" on public.products for select using (status = 'published');
create policy "published product translations read" on public.product_translations for select using (exists (select 1 from public.products where id = product_id and status = 'published'));
create policy "published options read" on public.product_options for select using (exists (select 1 from public.products where id = product_id and status = 'published'));
create policy "published documents read" on public.product_documents for select using (status = 'published');
create policy "closed dates read" on public.closed_dates for select using (true);
create policy "published legal read" on public.legal_documents for select using (status = 'published' or public.is_admin());
create policy "required legal types read" on public.required_legal_document_types for select using (true);
create policy "own orders read" on public.orders for select using ((select auth.uid()) = user_id or public.is_admin());
create policy "own lines read" on public.order_lines for select using (exists (select 1 from public.orders where id = order_id and (user_id = (select auth.uid()) or public.is_admin())));
create policy "own history read" on public.order_status_history for select using (exists (select 1 from public.orders where id = order_id and (user_id = (select auth.uid()) or public.is_admin())));

do $$ declare table_name text; begin
  foreach table_name in array array['shop_settings','locales','currencies','shipping_zones','shipping_methods','shipping_rates','markets','translation_entries','required_translation_keys','categories','category_translations','products','product_translations','product_options','product_documents','closed_dates','business_profile','legal_documents','orders','order_lines','order_status_history','stripe_events','import_jobs','audit_log'] loop
    execute format('create policy "admin full access" on public.%I for all using (public.is_admin()) with check (public.is_admin())', table_name);
  end loop;
end $$;

revoke all on public.products from anon, authenticated;
grant select (id,sku,category_slug,status,base_currency,production_days_min,production_days_max,approved_image_path,gallery,personalized,created_at,updated_at) on public.products to anon, authenticated;
create policy "admin required legal access" on public.required_legal_document_types for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artwork-private','artwork-private',false,209715200,array['application/pdf','application/postscript','image/svg+xml'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "admins read artwork" on storage.objects for select using (bucket_id = 'artwork-private' and public.is_admin());
create policy "admins manage artwork" on storage.objects for all using (bucket_id = 'artwork-private' and public.is_admin()) with check (bucket_id = 'artwork-private' and public.is_admin());

create table public.artwork_uploads (
  path text primary key,
  cart_session uuid not null,
  file_name text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 209715200),
  mime text not null check (mime in ('application/pdf','application/postscript','image/svg+xml')),
  status text not null default 'authorized' check (status in ('authorized','attached','quarantined','approved','rejected')),
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
alter table public.artwork_uploads enable row level security;
create policy "service role artwork access" on public.artwork_uploads for all to service_role using (true) with check (true);
create index artwork_uploads_order_id_idx on public.artwork_uploads(order_id);

create table public.service_rate_limits (
  key_hash text not null,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (key_hash, action, window_start)
);
alter table public.service_rate_limits enable row level security;
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
revoke execute on function public.validate_locale_activation() from public, anon, authenticated;
revoke execute on function public.validate_product_publication() from public, anon, authenticated;
revoke execute on function public.validate_launch_ready() from public, anon, authenticated;
revoke execute on function public.protect_published_legal_version() from public, anon, authenticated;

create index if not exists audit_log_actor_id_idx on public.audit_log(actor_id);
create index if not exists category_translations_locale_idx on public.category_translations(locale);
create index if not exists closed_dates_zone_code_idx on public.closed_dates(zone_code);
create index if not exists import_jobs_created_by_idx on public.import_jobs(created_by);
create index if not exists legal_documents_approved_by_idx on public.legal_documents(approved_by);
create index if not exists legal_documents_locale_idx on public.legal_documents(locale);
create index if not exists markets_default_currency_idx on public.markets(default_currency);
create index if not exists markets_default_locale_idx on public.markets(default_locale);
create index if not exists markets_shipping_zone_code_idx on public.markets(shipping_zone_code);
create index if not exists order_lines_order_id_idx on public.order_lines(order_id);
create index if not exists order_lines_product_id_idx on public.order_lines(product_id);
create index if not exists order_status_history_created_by_idx on public.order_status_history(created_by);
create index if not exists order_status_history_order_id_idx on public.order_status_history(order_id);
create index if not exists orders_currency_idx on public.orders(currency);
create index if not exists orders_locale_idx on public.orders(locale);
create index if not exists orders_market_code_idx on public.orders(market_code);
create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists product_documents_locale_idx on public.product_documents(locale);
create index if not exists product_documents_product_id_idx on public.product_documents(product_id);
create index if not exists products_base_currency_idx on public.products(base_currency);
create index if not exists shipping_rates_method_id_idx on public.shipping_rates(method_id);
create index if not exists shipping_rates_product_id_idx on public.shipping_rates(product_id);
create index if not exists shipping_rates_zone_code_idx on public.shipping_rates(zone_code);
create index if not exists shop_settings_updated_by_idx on public.shop_settings(updated_by);
