-- ============================================================
-- SHOPS
-- ============================================================
create table public.shops (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references auth.users(id) on delete cascade,
  name        text not null,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index shops_slug_idx on public.shops(slug);

create trigger shops_updated_at
  before update on public.shops
  for each row execute function public.set_updated_at();

alter table public.shops enable row level security;

create policy "shops_public_read" on public.shops
  for select using (active = true);

create policy "shops_owner_read" on public.shops
  for select using (auth.uid() = owner_id);

-- ============================================================
-- SHOP PRODUCTS (curation + pricing)
-- ============================================================
create table public.shop_products (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  markup_type   text not null check (markup_type in ('flat', 'percentage')),
  markup_value  numeric(12, 2) not null check (markup_value >= 0),
  created_at    timestamptz not null default now(),
  unique (shop_id, product_id)
);

create index shop_products_shop_id_idx on public.shop_products(shop_id);
create index shop_products_product_id_idx on public.shop_products(product_id);

alter table public.shop_products enable row level security;

create policy "shop_products_public_read" on public.shop_products
  for select using (
    exists (select 1 from public.shops s where s.id = shop_id and s.active = true)
  );

create policy "shop_products_owner_write" on public.shop_products
  for all using (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  );

-- Derived pricing — never stored, always current with the product's base price.
create view public.shop_products_priced
  with (security_invoker = true) as
select
  sp.id,
  sp.shop_id,
  sp.product_id,
  sp.markup_type,
  sp.markup_value,
  p.price as base_price,
  case sp.markup_type
    when 'flat' then p.price + sp.markup_value
    else round(p.price * (1 + sp.markup_value / 100), 2)
  end as shop_price,
  sp.created_at
from public.shop_products sp
join public.products p on p.id = sp.product_id;

-- ============================================================
-- ORDERS: shop attribution
-- ============================================================
alter table public.orders add column shop_id uuid references public.shops(id) on delete set null;
create index orders_shop_id_idx on public.orders(shop_id);
