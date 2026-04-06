-- Drop profiles table if it was partially created
drop table if exists public.profiles cascade;

-- ============================================================
-- PUBLIC USERS TABLE
-- Mirrors auth.users with app-level fields (role, etc.)
-- ============================================================
create table if not exists public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- Users can read their own row
create policy "users_own_read" on public.users
  for select using (auth.uid() = id);

-- Auto-create row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, role)
  values (new.id, coalesce(new.raw_app_meta_data->>'role', 'customer'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update is_admin() to use the new table
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists(
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  )
$$;

-- Backfill all existing auth users
insert into public.users (id, role)
select
  id,
  coalesce(raw_app_meta_data->>'role', 'customer') as role
from auth.users
on conflict (id) do update set role = excluded.role;

-- Update admin RLS policies to reference public.users instead of public.profiles
drop policy if exists "categories_admin_write" on public.categories;
drop policy if exists "products_admin_all" on public.products;
drop policy if exists "orders_admin_all" on public.orders;
drop policy if exists "order_events_admin_all" on public.order_events;
drop policy if exists "coupons_admin_all" on public.coupons;

create policy "categories_admin_write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy "products_admin_all" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

create policy "orders_admin_all" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

create policy "order_events_admin_all" on public.order_events
  for all using (public.is_admin()) with check (public.is_admin());

create policy "coupons_admin_all" on public.coupons
  for all using (public.is_admin()) with check (public.is_admin());
