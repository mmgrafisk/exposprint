create or replace function public.admin_product_rows(target_product_id uuid default null)
returns table (
  id uuid,
  sku text,
  status public.product_status,
  category_slug text,
  supplier_cost_minor integer,
  net_price_minor_dkk integer,
  production_days_min integer,
  production_days_max integer,
  approved_image_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.sku,
    p.status,
    p.category_slug,
    p.supplier_cost_minor,
    p.net_price_minor_dkk,
    p.production_days_min,
    p.production_days_max,
    p.approved_image_path
  from public.products p
  where public.is_admin()
    and (target_product_id is null or p.id = target_product_id)
  order by p.sku;
$$;

revoke all on function public.admin_product_rows(uuid) from public, anon;
grant execute on function public.admin_product_rows(uuid) to authenticated;

grant update (
  supplier_cost_minor,
  production_days_min,
  production_days_max,
  status,
  updated_at
) on public.products to authenticated;
