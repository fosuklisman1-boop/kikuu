-- Helper function: returns true if the current user has role = 'admin' in app_metadata
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  )
$$;

-- Categories: admins can insert/update/delete
create policy "categories_admin_write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- Products: admins can read all (including draft/out_of_stock) and write
create policy "products_admin_all" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- Orders: admins can read and update all orders
create policy "orders_admin_all" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

-- Order events: admins can read and insert all
create policy "order_events_admin_all" on public.order_events
  for all using (public.is_admin()) with check (public.is_admin());

-- Coupons: admins can manage coupons
create policy "coupons_admin_all" on public.coupons
  for all using (public.is_admin()) with check (public.is_admin());
