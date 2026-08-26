-- ============================================================
-- SHOP PAYOUT DETAILS
-- ============================================================
alter table public.shops add column momo_number text;
alter table public.shops add column momo_name text;

-- ============================================================
-- WITHDRAWAL SETTINGS (single-row config)
-- ============================================================
create table public.withdrawal_settings (
  id          boolean primary key default true,
  min_amount  numeric(12, 2) not null default 50,
  updated_at  timestamptz not null default now(),
  constraint withdrawal_settings_singleton check (id = true)
);

insert into public.withdrawal_settings (id, min_amount) values (true, 50);

create trigger withdrawal_settings_updated_at
  before update on public.withdrawal_settings
  for each row execute function public.set_updated_at();

alter table public.withdrawal_settings enable row level security;

create policy "withdrawal_settings_public_read" on public.withdrawal_settings
  for select using (true);

-- ============================================================
-- WITHDRAWAL REQUESTS
-- ============================================================
create table public.withdrawal_requests (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  amount        numeric(12, 2) not null check (amount > 0),
  momo_number   text not null,
  momo_name     text not null,
  status        text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  admin_note    text,
  requested_at  timestamptz not null default now(),
  processed_at  timestamptz,
  processed_by  uuid references auth.users(id) on delete set null
);

create index withdrawal_requests_shop_id_idx on public.withdrawal_requests(shop_id);
create index withdrawal_requests_status_idx on public.withdrawal_requests(status);

create unique index withdrawal_requests_one_pending_per_shop
  on public.withdrawal_requests(shop_id) where (status = 'pending');

alter table public.withdrawal_requests enable row level security;

create policy "withdrawal_requests_owner_read" on public.withdrawal_requests
  for select using (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  );

-- ============================================================
-- WALLET TRANSACTIONS: link a debit back to its withdrawal
-- ============================================================
alter table public.wallet_transactions
  add column withdrawal_request_id uuid references public.withdrawal_requests(id) on delete set null;

alter table public.wallet_transactions
  add constraint wallet_transactions_withdrawal_request_id_key unique (withdrawal_request_id);
