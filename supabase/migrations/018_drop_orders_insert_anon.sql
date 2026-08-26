-- The anon-insert policy on orders was originally added for a guest-checkout
-- flow that no longer exists — all order creation goes through the
-- service-role client in app/api/checkout/route.ts, which bypasses RLS
-- entirely. Left in place, this policy lets anyone with the public anon key
-- insert an arbitrary orders row (including a self-chosen items price),
-- which the wallet-earnings ledger would trust as real money.
drop policy if exists "orders_insert_anon" on public.orders;
