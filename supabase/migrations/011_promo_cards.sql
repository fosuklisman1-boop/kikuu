-- supabase/migrations/011_promo_cards.sql

create table public.promo_cards (
  id           uuid primary key default gen_random_uuid(),
  heading      text not null,
  subtext      text,
  badge_text   text,
  cta_text     text,
  cta_link     text,
  color_theme  text not null default 'amber'
               check (color_theme in ('amber', 'green', 'blue', 'purple', 'red')),
  coupon_id    uuid references public.coupons(id) on delete set null,
  sort_order   int not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.promo_cards enable row level security;

create policy "public_read_active_promo_cards" on public.promo_cards
  for select using (active = true);

create policy "admins_manage_promo_cards" on public.promo_cards
  for all using (public.is_admin()) with check (public.is_admin());

create index promo_cards_active_sort_idx on public.promo_cards (sort_order) where active = true;

-- Seed the card that was previously hardcoded on the homepage.
-- coupon_id is null — admin links it to ACCRA200 manually after that coupon is created.
insert into public.promo_cards (heading, subtext, badge_text, cta_text, cta_link, color_theme, sort_order)
values (
  'Free Delivery in Accra',
  'On all orders over GHS 200. Use the code below at checkout.',
  'Limited Time Offer',
  'Shop Now',
  '/products',
  'amber',
  0
);
