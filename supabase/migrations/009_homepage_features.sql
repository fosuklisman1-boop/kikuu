-- supabase/migrations/009_homepage_features.sql

-- ─── Hero carousel banners ───────────────────────────────────────────────────
create table if not exists public.banners (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  subtitle   text,
  image_url  text not null,
  cta_text   text,
  cta_link   text,
  sort_order int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.banners enable row level security;

create policy "public_read_active_banners" on public.banners
  for select using (active = true);

create policy "admins_manage_banners" on public.banners
  for all using (public.is_admin()) with check (public.is_admin());

create index if not exists banners_active_sort_idx on public.banners (sort_order) where active = true;

-- ─── Flash sales ─────────────────────────────────────────────────────────────
create table if not exists public.flash_sales (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null check (ends_at > starts_at),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.flash_sales enable row level security;

create policy "public_read_active_flash_sales" on public.flash_sales
  for select using (active = true);

create policy "admins_manage_flash_sales" on public.flash_sales
  for all using (public.is_admin()) with check (public.is_admin());

create index if not exists flash_sales_active_idx on public.flash_sales (ends_at) where active = true;

-- ─── Flash sale items ────────────────────────────────────────────────────────
create table if not exists public.flash_sale_items (
  id            uuid primary key default gen_random_uuid(),
  flash_sale_id uuid not null references public.flash_sales(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  sale_price    numeric(10,2) not null check (sale_price > 0),
  sort_order    int not null default 0,
  unique(flash_sale_id, product_id)
);

alter table public.flash_sale_items enable row level security;

create policy "public_read_flash_sale_items" on public.flash_sale_items
  for select using (
    exists (
      select 1 from public.flash_sales fs
      where fs.id = flash_sale_id and fs.active = true
    )
  );

create policy "admins_manage_flash_sale_items" on public.flash_sale_items
  for all using (public.is_admin()) with check (public.is_admin());

create index if not exists flash_sale_items_flash_sale_id_idx on public.flash_sale_items (flash_sale_id);
create index if not exists flash_sale_items_sort_idx on public.flash_sale_items (sort_order);

-- ─── Brands ──────────────────────────────────────────────────────────────────
create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  logo_url   text not null,
  sort_order int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.brands enable row level security;

create policy "public_read_active_brands" on public.brands
  for select using (active = true);

create policy "admins_manage_brands" on public.brands
  for all using (public.is_admin()) with check (public.is_admin());

create index if not exists brands_active_sort_idx on public.brands (sort_order) where active = true;

alter table public.products
  add column if not exists brand_id uuid references public.brands(id) on delete set null;

create index if not exists products_brand_id_idx on public.products (brand_id);

-- ─── Trending searches ───────────────────────────────────────────────────────
create table if not exists public.trending_searches (
  id         uuid primary key default gen_random_uuid(),
  query      text not null,
  sort_order int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.trending_searches enable row level security;

create policy "public_read_active_trending_searches" on public.trending_searches
  for select using (active = true);

create policy "admins_manage_trending_searches" on public.trending_searches
  for all using (public.is_admin()) with check (public.is_admin());

create index if not exists trending_searches_active_sort_idx on public.trending_searches (sort_order) where active = true;
