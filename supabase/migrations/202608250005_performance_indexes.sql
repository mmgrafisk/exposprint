drop policy if exists "own orders read" on public.orders;
create policy "own orders read" on public.orders for select
  using ((select auth.uid()) = user_id or public.is_admin());
drop policy if exists "own lines read" on public.order_lines;
create policy "own lines read" on public.order_lines for select
  using (exists (select 1 from public.orders where id = order_id and (user_id = (select auth.uid()) or public.is_admin())));
drop policy if exists "own history read" on public.order_status_history;
create policy "own history read" on public.order_status_history for select
  using (exists (select 1 from public.orders where id = order_id and (user_id = (select auth.uid()) or public.is_admin())));

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
