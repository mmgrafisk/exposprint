update storage.buckets
set allowed_mime_types = array['application/pdf','application/postscript','image/svg+xml']
where id = 'artwork-private';

create table if not exists public.artwork_uploads (
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
drop policy if exists "service role artwork access" on public.artwork_uploads;
create policy "service role artwork access" on public.artwork_uploads for all to service_role using (true) with check (true);
create index if not exists artwork_uploads_order_id_idx on public.artwork_uploads(order_id);
