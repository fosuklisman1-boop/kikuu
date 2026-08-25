-- ============================================================
-- WALLET TRANSACTIONS (append-only ledger)
-- ============================================================
create table public.wallet_transactions (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  type        text not null check (type in ('credit', 'debit')),
  amount      numeric(12, 2) not null check (amount > 0),
  description text not null,
  created_at  timestamptz not null default now(),
  unique (order_id, type)
);

create index wallet_transactions_shop_id_idx on public.wallet_transactions(shop_id);
create index wallet_transactions_order_id_idx on public.wallet_transactions(order_id);

alter table public.wallet_transactions enable row level security;

create policy "wallet_transactions_owner_read" on public.wallet_transactions
  for select using (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  );

-- ============================================================
-- WALLET BALANCE (derived, never stored)
-- ============================================================
create view public.wallet_balances
  with (security_invoker = true) as
select
  shop_id,
  coalesce(sum(case when type = 'credit' then amount else -amount end), 0) as balance
from public.wallet_transactions
group by shop_id;
