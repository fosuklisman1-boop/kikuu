create table public.announcements (
  id         uuid primary key default uuid_generate_v4(),
  message    text not null,
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create policy "announcements_public_read" on public.announcements
  for select using (true);

create policy "announcements_admin_write" on public.announcements
  for all using (public.is_admin()) with check (public.is_admin());

-- Seed with current hardcoded messages
insert into public.announcements (message, sort_order) values
  ('🚚 Free delivery in Accra on orders over GHS 200 — Use code ACCRA200', 0),
  ('🔥 Flash Sale: Up to 40% off Electronics this weekend only!', 1),
  ('💳 Pay with MTN MoMo and get instant cashback on your first order', 2),
  ('🎁 New arrivals every Monday — Follow us to stay updated!', 3);
