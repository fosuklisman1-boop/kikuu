-- product_colors: global pool of available colors
create table product_colors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  hex         text not null check (hex ~ '^#[0-9a-fA-F]{6}$'),
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- product_sizes: global pool of available sizes
create table product_sizes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- RLS: anyone can read active entries; only admins can write
alter table product_colors enable row level security;
alter table product_sizes  enable row level security;

create policy "Public read product_colors"
  on product_colors for select using (active = true);
create policy "Admin manage product_colors"
  on product_colors for all using (is_admin()) with check (is_admin());

create policy "Public read product_sizes"
  on product_sizes for select using (active = true);
create policy "Admin manage product_sizes"
  on product_sizes for all using (is_admin()) with check (is_admin());

-- Seed common clothing sizes (sort_order 1-7) and shoe sizes (10-19)
insert into product_sizes (name, sort_order) values
  ('XS', 1), ('S', 2), ('M', 3), ('L', 4),
  ('XL', 5), ('XXL', 6), ('XXXL', 7),
  ('36', 10), ('37', 11), ('38', 12), ('39', 13),
  ('40', 14), ('41', 15), ('42', 16), ('43', 17),
  ('44', 18), ('45', 19);
