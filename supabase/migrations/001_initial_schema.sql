-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enable full text search
create extension if not exists "pg_trgm";

-- ============================================================
-- CATEGORIES
-- ============================================================
create table public.categories (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  parent_id   uuid references public.categories(id) on delete set null,
  image_url   text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index categories_parent_id_idx on public.categories(parent_id);
create index categories_slug_idx on public.categories(slug);

-- ============================================================
-- PRODUCTS
-- ============================================================
create table public.products (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  slug              text not null unique,
  description       text,
  category_id       uuid not null references public.categories(id) on delete restrict,
  price             numeric(12, 2) not null check (price >= 0),
  compare_at_price  numeric(12, 2) check (compare_at_price >= 0),
  stock_qty         integer not null default 0 check (stock_qty >= 0),
  images            text[] not null default '{}',
  status            text not null default 'draft' check (status in ('active', 'draft', 'out_of_stock')),
  featured          boolean not null default false,
  attributes        jsonb not null default '{}',
  search_vector     tsvector generated always as (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) stored,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index products_category_id_idx on public.products(category_id);
create index products_status_idx on public.products(status);
create index products_featured_idx on public.products(featured) where featured = true;
create index products_search_idx on public.products using gin(search_vector);
create index products_slug_idx on public.products(slug);
create index products_name_trgm_idx on public.products using gin(name gin_trgm_ops);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ============================================================
-- ORDERS
-- ============================================================
create table public.orders (
  id                  uuid primary key default uuid_generate_v4(),
  order_number        text not null unique,
  buyer_id            uuid references auth.users(id) on delete set null,
  buyer_email         text not null,
  buyer_phone         text not null,
  buyer_name          text not null,
  shipping_address    jsonb not null,
  items               jsonb not null,
  subtotal            numeric(12, 2) not null,
  shipping_fee        numeric(12, 2) not null default 0,
  discount_amount     numeric(12, 2) not null default 0,
  total               numeric(12, 2) not null,
  status              text not null default 'pending' check (
    status in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')
  ),
  payment_method      text,
  payment_reference   text,
  paystack_reference  text unique,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index orders_buyer_id_idx on public.orders(buyer_id);
create index orders_status_idx on public.orders(status);
create index orders_paystack_reference_idx on public.orders(paystack_reference);
create index orders_created_at_idx on public.orders(created_at desc);

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Auto-generate order number: KK-YYYYMMDD-XXXX
create or replace function public.generate_order_number()
returns trigger language plpgsql as $$
begin
  new.order_number = 'KK-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0');
  return new;
end;
$$;

create trigger orders_generate_number
  before insert on public.orders
  for each row execute function public.generate_order_number();

-- ============================================================
-- ORDER EVENTS (audit trail / tracking)
-- ============================================================
create table public.order_events (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  event       text not null,
  description text,
  created_at  timestamptz not null default now()
);

create index order_events_order_id_idx on public.order_events(order_id);

-- ============================================================
-- COUPONS
-- ============================================================
create table public.coupons (
  id                uuid primary key default uuid_generate_v4(),
  code              text not null unique,
  type              text not null check (type in ('percentage', 'fixed')),
  value             numeric(12, 2) not null check (value > 0),
  min_order_amount  numeric(12, 2),
  max_uses          integer,
  used_count        integer not null default 0,
  expires_at        timestamptz,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

create index coupons_code_idx on public.coupons(code);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Categories: public read, admin write (via service role)
alter table public.categories enable row level security;
create policy "categories_public_read" on public.categories for select using (true);

-- Products: public read active, admin write
alter table public.products enable row level security;
create policy "products_public_read" on public.products for select using (status = 'active');

-- Orders: buyers see their own orders
alter table public.orders enable row level security;
create policy "orders_buyer_read" on public.orders for select
  using (auth.uid() = buyer_id);
create policy "orders_insert_anon" on public.orders for insert
  with check (true); -- allow guest checkout

-- Order events: buyers see their own order events
alter table public.order_events enable row level security;
create policy "order_events_buyer_read" on public.order_events for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.buyer_id = auth.uid()
    )
  );

-- Coupons: no public read (validated server-side only)
alter table public.coupons enable row level security;
