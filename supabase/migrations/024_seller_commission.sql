-- ============================================================
-- COMMISSION SETTINGS (single-row config: default % sellers earn per sale)
-- ============================================================
create table public.commission_settings (
  id               boolean primary key default true,
  default_percent  numeric(5, 2) not null default 10 check (default_percent >= 0 and default_percent <= 100),
  updated_at       timestamptz not null default now(),
  constraint commission_settings_singleton check (id = true)
);

insert into public.commission_settings (id, default_percent) values (true, 10);

create trigger commission_settings_updated_at
  before update on public.commission_settings
  for each row execute function public.set_updated_at();

alter table public.commission_settings enable row level security;

create policy "commission_settings_public_read" on public.commission_settings
  for select using (true);

-- ============================================================
-- PER-PRODUCT OVERRIDE (null = use the default percent)
-- ============================================================
alter table public.products
  add column commission_percent numeric(5, 2)
  check (commission_percent is null or (commission_percent >= 0 and commission_percent <= 100));

-- ============================================================
-- SHOP PRODUCTS: sellers no longer set markup
-- Legacy markup columns are kept (ignored) so no data is lost.
-- ============================================================
alter table public.shop_products alter column markup_type set default 'flat';
alter table public.shop_products alter column markup_value set default 0;

-- Shop price is now the normal product price. commission_percent is the
-- effective rate: the product's override, else the global default.
drop view if exists public.shop_products_priced;
create view public.shop_products_priced
  with (security_invoker = true) as
select
  sp.id,
  sp.shop_id,
  sp.product_id,
  sp.markup_type,
  sp.markup_value,
  p.price as base_price,
  p.price as shop_price,
  coalesce(p.commission_percent, (select default_percent from public.commission_settings where id = true), 0) as commission_percent,
  sp.created_at
from public.shop_products sp
join public.products p on p.id = sp.product_id;
