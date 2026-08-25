-- Split admin writes from public/customer reads so each operation evaluates one
-- permissive policy. Admin read access is folded into the relevant read policy.
alter policy "public settings read" on public.shop_settings using (key in ('default_locale','fallback_locale','default_market','default_currency','gross_margin_percent','support_email','launch_ready') or public.is_admin());
alter policy "active locales read" on public.locales using (enabled or public.is_admin());
alter policy "active currencies read" on public.currencies using (enabled or public.is_admin());
alter policy "active zones read" on public.shipping_zones using (enabled or public.is_admin());
alter policy "active methods read" on public.shipping_methods using (enabled or public.is_admin());
alter policy "active rates read" on public.shipping_rates using (enabled or public.is_admin());
alter policy "active markets read" on public.markets using (enabled or public.is_admin());
alter policy "active translations read" on public.translation_entries using (public.is_admin() or exists (select 1 from public.locales where code = locale and enabled));
alter policy "published categories read" on public.categories using (status = 'published' or public.is_admin());
alter policy "published category translations read" on public.category_translations using (public.is_admin() or exists (select 1 from public.categories where id = category_id and status = 'published'));
alter policy "published products read" on public.products using (status = 'published' or public.is_admin());
alter policy "published product translations read" on public.product_translations using (public.is_admin() or exists (select 1 from public.products where id = product_id and status = 'published'));
alter policy "published options read" on public.product_options using (public.is_admin() or exists (select 1 from public.products where id = product_id and status = 'published'));
alter policy "published documents read" on public.product_documents using (status = 'published' or public.is_admin());

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'shop_settings','locales','currencies','shipping_zones','shipping_methods','shipping_rates','markets',
    'translation_entries','categories','category_translations','products','product_translations','product_options',
    'product_documents','closed_dates','legal_documents','orders','order_lines','order_status_history'
  ] loop
    execute format('drop policy if exists "admin full access" on public.%I', table_name);
    execute format('create policy "admin insert access" on public.%I for insert to authenticated with check (public.is_admin())', table_name);
    execute format('create policy "admin update access" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', table_name);
    execute format('create policy "admin delete access" on public.%I for delete to authenticated using (public.is_admin())', table_name);
  end loop;
end $$;

drop policy if exists "admin required legal access" on public.required_legal_document_types;
create policy "admin required legal insert" on public.required_legal_document_types for insert to authenticated with check (public.is_admin());
create policy "admin required legal update" on public.required_legal_document_types for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin required legal delete" on public.required_legal_document_types for delete to authenticated using (public.is_admin());
