create table public.delivery_fees (
  region    text primary key,
  fee       numeric(10, 2) not null default 0 check (fee >= 0),
  enabled   boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.delivery_fees enable row level security;

-- Public read (needed by checkout form)
create policy "delivery_fees_public_read" on public.delivery_fees
  for select using (true);

-- Only admins can write
create policy "delivery_fees_admin_write" on public.delivery_fees
  for all using (public.is_admin()) with check (public.is_admin());

-- Seed with current values
insert into public.delivery_fees (region, fee) values
  ('Greater Accra',  15),
  ('Ashanti',        25),
  ('Western',        30),
  ('Eastern',        25),
  ('Central',        25),
  ('Volta',          30),
  ('Northern',       45),
  ('Upper East',     50),
  ('Upper West',     50),
  ('Brong-Ahafo',    35),
  ('Oti',            40),
  ('Bono East',      40),
  ('Ahafo',          40),
  ('Savannah',       50),
  ('North East',     50),
  ('Western North',  40)
on conflict (region) do nothing;
