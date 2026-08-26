-- One owner, database-driven i18n, safe storefront pricing and destination snapshots.

alter table public.products add column if not exists net_price_minor_dkk bigint check (net_price_minor_dkk is null or net_price_minor_dkk >= 0);

create or replace function public.refresh_product_net_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare margin numeric;
begin
  select coalesce((value #>> '{}')::numeric, 40) into margin
  from public.shop_settings where key = 'gross_margin_percent';
  margin := least(95, greatest(0, coalesce(margin, 40)));
  new.net_price_minor_dkk := case
    when new.price_override_minor is not null then new.price_override_minor
    when new.supplier_cost_minor is not null then round(new.supplier_cost_minor / (1 - margin / 100.0))::bigint
    else null
  end;
  return new;
end
$$;

drop trigger if exists refresh_product_net_price_trigger on public.products;
create trigger refresh_product_net_price_trigger
before insert or update of supplier_cost_minor, price_override_minor on public.products
for each row execute function public.refresh_product_net_price();

create or replace function public.refresh_all_product_net_prices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.key = 'gross_margin_percent' and new.value is distinct from old.value then
    update public.products set supplier_cost_minor = supplier_cost_minor;
  end if;
  return new;
end
$$;

drop trigger if exists refresh_prices_after_margin_change on public.shop_settings;
create trigger refresh_prices_after_margin_change
after update of value on public.shop_settings
for each row execute function public.refresh_all_product_net_prices();

update public.products
set net_price_minor_dkk = case
  when price_override_minor is not null then price_override_minor
  when supplier_cost_minor is not null then round(supplier_cost_minor / 0.60)::bigint
  else null
end;

revoke all on function public.refresh_product_net_price() from public, anon, authenticated;
revoke all on function public.refresh_all_product_net_prices() from public, anon, authenticated;

create table if not exists public.admin_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.admin_owner enable row level security;
revoke all on public.admin_owner from anon, authenticated;
grant select on public.admin_owner to anon, authenticated;
create policy "owner reads own identity" on public.admin_owner
for select to authenticated using ((select auth.uid()) = user_id);
create policy "service manages owner" on public.admin_owner
for all to service_role using (true) with check (true);

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    and exists (
      select 1 from public.admin_owner owner
      where owner.user_id = (select auth.uid())
    )
$$;

create table if not exists public.product_option_translations (
  option_id uuid not null references public.product_options(id) on delete cascade,
  locale text not null references public.locales(code) on delete cascade,
  label text not null,
  values jsonb not null default '[]'::jsonb check (jsonb_typeof(values) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (option_id, locale)
);
alter table public.product_option_translations enable row level security;
create policy "published option translations read" on public.product_option_translations
for select using (
  public.is_admin() or exists (
    select 1 from public.product_options option
    join public.products product on product.id = option.product_id
    where option.id = option_id and product.status = 'published'
  )
);
create policy "admin option translations insert" on public.product_option_translations
for insert to authenticated with check (public.is_admin());
create policy "admin option translations update" on public.product_option_translations
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin option translations delete" on public.product_option_translations
for delete to authenticated using (public.is_admin());

create table if not exists public.shipping_method_translations (
  method_id uuid not null references public.shipping_methods(id) on delete cascade,
  locale text not null references public.locales(code) on delete cascade,
  name text not null,
  description text not null default '',
  updated_at timestamptz not null default now(),
  primary key (method_id, locale)
);
alter table public.shipping_method_translations enable row level security;
create policy "active shipping translations read" on public.shipping_method_translations
for select using (public.is_admin() or exists (select 1 from public.shipping_methods where id = method_id and enabled));
create policy "admin shipping translations insert" on public.shipping_method_translations for insert to authenticated with check (public.is_admin());
create policy "admin shipping translations update" on public.shipping_method_translations for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin shipping translations delete" on public.shipping_method_translations for delete to authenticated using (public.is_admin());

create table if not exists public.order_status_translations (
  status public.order_status not null,
  locale text not null references public.locales(code) on delete cascade,
  label text not null,
  description text not null default '',
  updated_at timestamptz not null default now(),
  primary key (status, locale)
);
alter table public.order_status_translations enable row level security;
create policy "order status translations read" on public.order_status_translations for select using (true);
create policy "admin order status translations insert" on public.order_status_translations for insert to authenticated with check (public.is_admin());
create policy "admin order status translations update" on public.order_status_translations for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin order status translations delete" on public.order_status_translations for delete to authenticated using (public.is_admin());

create table if not exists public.email_templates (
  template_key text not null,
  locale text not null references public.locales(code) on delete cascade,
  subject text not null,
  body_text text not null,
  body_html text not null,
  status public.content_status not null default 'draft',
  updated_at timestamptz not null default now(),
  primary key (template_key, locale)
);
alter table public.email_templates enable row level security;
create policy "admin email templates read" on public.email_templates for select to authenticated using (public.is_admin());
create policy "admin email templates insert" on public.email_templates for insert to authenticated with check (public.is_admin());
create policy "admin email templates update" on public.email_templates for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin email templates delete" on public.email_templates for delete to authenticated using (public.is_admin());

alter table public.translation_entries add column if not exists status public.content_status not null default 'published';
alter table public.translation_entries add column if not exists updated_by uuid references auth.users(id);

alter table public.orders add column if not exists visitor_country text check (visitor_country ~ '^[A-Z]{2}$');
alter table public.orders add column if not exists destination_country text check (destination_country ~ '^[A-Z]{2}$');

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default '',
  recipient text not null,
  company text,
  address_line_1 text not null,
  address_line_2 text,
  postal_code text not null,
  city text not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customer_addresses_one_default on public.customer_addresses(user_id) where is_default;
alter table public.customer_addresses enable row level security;
create policy "customers read own addresses" on public.customer_addresses for select to authenticated using ((select auth.uid()) = user_id or public.is_admin());
create policy "customers insert own addresses" on public.customer_addresses for insert to authenticated with check ((select auth.uid()) = user_id or public.is_admin());
create policy "customers update own addresses" on public.customer_addresses for update to authenticated using ((select auth.uid()) = user_id or public.is_admin()) with check ((select auth.uid()) = user_id or public.is_admin());
create policy "customers delete own addresses" on public.customer_addresses for delete to authenticated using ((select auth.uid()) = user_id or public.is_admin());

alter table public.required_translation_keys drop constraint if exists required_translation_keys_area_check;
alter table public.required_translation_keys add constraint required_translation_keys_area_check
check (area in ('navigation','storefront','checkout','account','admin','email','legal','accessibility','seo'));

insert into public.shop_settings(key,value) values
  ('geo_fallback_locale','"en"'::jsonb),
  ('geo_fallback_currency','"EUR"'::jsonb),
  ('brand_name','"ExposPrint"'::jsonb)
on conflict(key) do nothing;

-- Initial automatic market policy. Administrators can change these rows later.
update public.markets
set default_locale = 'en', default_currency = 'EUR', updated_at = now()
where country_code not in ('DK', 'DE');
update public.markets
set default_locale = 'da', default_currency = 'DKK', updated_at = now()
where country_code = 'DK';
update public.markets
set default_locale = 'de', default_currency = 'EUR', updated_at = now()
where country_code = 'DE';

insert into public.required_translation_keys(namespace,key,area) values
  ('system','missingTranslation','accessibility'),
  ('meta','title','seo'),
  ('meta','titleTemplate','seo'),
  ('meta','description','seo'),
  ('market','detected','storefront'),
  ('market','summary','storefront'),
  ('market','automatic','storefront'),
  ('checkout','destinationCountry','checkout'),
  ('checkout','destinationHelp','checkout'),
  ('admin','loginTitle','admin'),
  ('admin','password','admin'),
  ('admin','mfaCode','admin')
on conflict(namespace,key) do update set area = excluded.area;

drop policy if exists "public settings read" on public.shop_settings;
create policy "public settings read" on public.shop_settings for select
using (key in ('default_locale','fallback_locale','default_market','default_currency','gross_margin_percent','support_email','launch_ready','geo_fallback_locale','geo_fallback_currency','brand_name') or public.is_admin());

revoke all on public.products from anon, authenticated;
grant select (id,sku,category_slug,status,base_currency,net_price_minor_dkk,production_days_min,production_days_max,approved_image_path,gallery,personalized,created_at,updated_at)
on public.products to anon, authenticated;

grant select on public.shop_settings, public.locales, public.currencies, public.markets,
  public.shipping_zones, public.translation_entries, public.legal_documents,
  public.categories, public.category_translations, public.product_translations,
  public.product_options, public.product_option_translations, public.closed_dates,
  public.required_legal_document_types, public.order_status_translations
to anon, authenticated;

grant select, insert, update, delete on public.customer_addresses to authenticated;

create index if not exists product_option_translations_locale_idx on public.product_option_translations(locale);
create index if not exists shipping_method_translations_locale_idx on public.shipping_method_translations(locale);
create index if not exists order_status_translations_locale_idx on public.order_status_translations(locale);
create index if not exists email_templates_locale_idx on public.email_templates(locale);
create index if not exists orders_destination_country_idx on public.orders(destination_country);
