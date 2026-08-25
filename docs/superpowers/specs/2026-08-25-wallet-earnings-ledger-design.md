# Order Attribution & Earnings Ledger — Design Spec

**Sub-project 3 of the seller-shops initiative** (order in this session: Shops & Curation → this spec → Withdrawals; subdomain routing is deferred, not skipped).

Builds directly on sub-project 1's `orders.shop_id` (already live). Turns "this order came from a shop" into "the seller's wallet balance grew" — a running, auditable ledger of what each seller has earned, ready for sub-project 4 (withdrawals) to debit against. **Out of scope here:** any actual money movement (Paystack Transfers / MTN MoMo payout) — this spec only gets a seller from "I made a sale" to "I can see my balance and history," matching how sub-project 1 stopped at "a customer can buy," not "the seller gets paid."

## Goal

When a shop-attributed order's payment is confirmed, credit the seller's wallet with their exact markup on that order (100% of it — no platform commission for now). If that order is later refunded or cancelled, reverse the credit. Sellers see a running balance and transaction history at `/seller/wallet`.

## Architecture

**Tech stack:** unchanged from sub-project 1 — Next.js 16, Supabase (Postgres + RLS), Zod, Vitest.

An append-only ledger table (`wallet_transactions`) is the only source of truth; balance is never stored, always computed live as `SUM(credit) − SUM(debit)` via a view (`wallet_balances`), mirroring the `shop_products_priced` derived-pricing pattern from sub-project 1 — no cache to go stale, no sync job. A unique constraint on `(order_id, type)` makes crediting and reversing naturally idempotent, so hooking into this codebase's existing dual payment-confirmation paths (inline Paystack popup callback *and* the server-to-server webhook, which already race each other and are already guarded for stock-decrement) needs no new locking — a duplicate insert just fails harmlessly and is treated as "already done."

To make a refund reversal exact rather than recomputed (and immune to an admin changing the base price in between), `orders.items` gains a `base_price` field, frozen at checkout time for shop-attributed items only. The credit amount is `Σ (item.price − item.base_price) × item.quantity`; the reversal just negates whatever the original credit transaction recorded — it never recalculates.

---

## Database (migration `017_seller_wallet.sql`)

```sql
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
  -- Postgres treats NULL as distinct in unique constraints, so this only
  -- constrains order-linked rows: at most one credit and one debit per
  -- order. Future withdrawal debits (sub-project 4) will have order_id
  -- null and are unaffected by this constraint.
  unique (order_id, type)
);

create index wallet_transactions_shop_id_idx on public.wallet_transactions(shop_id);
create index wallet_transactions_order_id_idx on public.wallet_transactions(order_id);

alter table public.wallet_transactions enable row level security;

create policy "wallet_transactions_owner_read" on public.wallet_transactions
  for select using (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  );

-- No insert/update/delete policy: every write happens through the
-- service-role client from server-only payment/admin code paths, never
-- from a seller-facing form. RLS here is a read-time safety net only,
-- matching the pattern established for shop_products in sub-project 1.

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
```

---

## Type system (`lib/supabase/types.ts`)

Add the table entry:

```ts
wallet_transactions: {
  Row: {
    id: string
    shop_id: string
    order_id: string | null
    type: 'credit' | 'debit'
    amount: number
    description: string
    created_at: string
  }
  Insert: Omit<Database['public']['Tables']['wallet_transactions']['Row'], 'id' | 'created_at'>
  Update: Partial<Database['public']['Tables']['wallet_transactions']['Insert']>
}
```

Convenience type:

```ts
export type WalletTransaction = Database['public']['Tables']['wallet_transactions']['Row']
```

Update the existing `OrderItem` interface to add `base_price`:

```ts
export interface OrderItem {
  product_id: string
  product_name: string
  product_image: string
  price: number
  base_price: number | null   // frozen shop base price at sale time; null for non-shop items
  quantity: number
  is_preorder: boolean
  preorder_ship_date: string | null
  preorder_note: string | null
  selected_color?: { name: string; hex: string }
  selected_size?: string
}
```

---

## Checkout: freeze `base_price` for shop orders (`app/api/checkout/route.ts`)

This modifies code sub-project 1 already added. The shop-pricing block currently does:

```ts
const { data: shopProducts } = await admin
  .from('shop_products_priced')
  .select('product_id, shop_price')
  .eq('shop_id', shop_id)
  .in('product_id', productIds)
for (const sp of shopProducts ?? []) {
  shopPriceMap.set(sp.product_id, sp.shop_price)
}
```

Change to also carry `base_price`, using a second map (keeps `shopPriceMap`'s existing type/call sites untouched elsewhere):

```ts
let shopBasePriceMap = new Map<string, number>()
if (shop_id) {
  // ...existing shop/active check unchanged...
  const { data: shopProducts } = await admin
    .from('shop_products_priced')
    .select('product_id, shop_price, base_price')
    .eq('shop_id', shop_id)
    .in('product_id', productIds)
  for (const sp of shopProducts ?? []) {
    shopPriceMap.set(sp.product_id, sp.shop_price)
    shopBasePriceMap.set(sp.product_id, sp.base_price)
  }
}
```

In the per-item `orderItems.push({...})` block, add one field:

```ts
base_price: shop_id ? shopBasePriceMap.get(product.id)! : null,
```

(Safe by the same invariant as the existing `shopPriceMap.get(product.id)!` two lines above it — both are guarded by the same earlier `if (shop_id && !shopPriceMap.has(product.id))` membership check in the same loop iteration.)

---

## Server actions and internal ledger functions — two files, deliberately split

**Security note, learned from sub-project 1's final review:** everything exported from a `'use server'` file becomes a client-callable POST endpoint, regardless of whether any UI actually references it. `creditShopEarnings`/`reverseShopEarnings` are meant to run ONLY from trusted server-side triggers (webhooks, admin actions) with no user session involved — they must never be reachable as a callable action at all, not just guarded. So they live in a plain (non-`'use server'`) module instead, which Next.js never turns into an endpoint since it's only ever imported by other server-side code. Both functions also independently re-verify the precondition they depend on (payment actually confirmed / order actually cancelled) rather than trusting the caller — the same "every privileged function re-checks its own invariant" discipline `requireAdmin()`'s own doc comment establishes elsewhere in this codebase.

### `lib/actions/wallet.ts` — new file, `'use server'`, client-facing reads only

```ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireShopOwner } from '@/lib/auth/require-shop-owner'
import type { WalletTransaction } from '@/lib/supabase/types'

export async function getWalletBalance(): Promise<number> {
  const { shopId } = await requireShopOwner()
  const admin = createAdminClient()
  const { data } = await admin.from('wallet_balances').select('balance').eq('shop_id', shopId).maybeSingle()
  return data?.balance ?? 0
}

export async function getWalletTransactions(): Promise<WalletTransaction[]> {
  const { shopId } = await requireShopOwner()
  const admin = createAdminClient()
  const { data } = await admin
    .from('wallet_transactions')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
  return data ?? []
}
```

### `lib/wallet-earnings.ts` — new file, pure calculation (no DB, no directive)

```ts
import type { OrderItem } from '@/lib/supabase/types'

export function computeOrderEarnings(items: OrderItem[]): number {
  return items.reduce(
    (sum, item) => sum + (item.base_price !== null ? (item.price - item.base_price) * item.quantity : 0),
    0
  )
}
```

### `lib/wallet-ledger.ts` — new file, NOT `'use server'` — server-only, never client-callable

```ts
import { createAdminClient } from '@/lib/supabase/admin'
import { computeOrderEarnings } from '@/lib/wallet-earnings'
import type { OrderItem } from '@/lib/supabase/types'

// Called only from payment-confirmation code paths (Paystack inline callback,
// webhook). Re-verifies payment_status itself rather than trusting the caller.
export async function creditShopEarnings(orderId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('shop_id, order_number, items, payment_status')
    .eq('id', orderId)
    .single()

  if (!order?.shop_id) return // not a shop order — no-op
  if (order.payment_status !== 'paid') return // precondition not actually met — no-op

  const amount = computeOrderEarnings((order.items as OrderItem[]) ?? [])
  if (amount <= 0) return

  const { error } = await admin.from('wallet_transactions').insert({
    shop_id: order.shop_id,
    order_id: orderId,
    type: 'credit',
    amount,
    description: `Earnings from order ${order.order_number}`,
  })
  // 23505 = unique violation on (order_id, type) — already credited, treat as success
  if (error && error.code !== '23505') throw new Error(error.message)
}

// Called only from the admin order-status update action. Re-verifies the
// order's current status itself rather than trusting the caller.
export async function reverseShopEarnings(orderId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('shop_id, order_number, status')
    .eq('id', orderId)
    .single()

  if (!order?.shop_id) return
  if (order.status !== 'cancelled' && order.status !== 'refunded') return

  const { data: credit } = await admin
    .from('wallet_transactions')
    .select('amount')
    .eq('order_id', orderId)
    .eq('type', 'credit')
    .maybeSingle()

  if (!credit) return // never credited — nothing to reverse

  const { error } = await admin.from('wallet_transactions').insert({
    shop_id: order.shop_id,
    order_id: orderId,
    type: 'debit',
    amount: credit.amount,
    description: `Reversal for cancelled/refunded order ${order.order_number}`,
  })
  if (error && error.code !== '23505') throw new Error(error.message)
}
```

---

## Wire into the three existing payment-status code paths

### `app/api/payment/verify/route.ts`

Inside `processVerification`, right after the existing stock-decrement loop (which runs inside the `if (updated && updated.length > 0) { ... }` block):

```ts
if (updated && updated.length > 0) {
  await admin.from('order_events').insert({ /* ...existing, unchanged... */ })

  const items = order.items as any[]
  for (const item of items) {
    if (!item.is_preorder) {
      await admin.rpc('decrement_stock', { p_product_id: item.product_id, p_qty: item.quantity })
    }
  }

  await creditShopEarnings(orderId)   // new line
}
```

Add `import { creditShopEarnings } from '@/lib/wallet-ledger'` at the top.

### `app/api/webhooks/paystack/route.ts`

Two changes:
1. The order lookup's `.select('id, status, total, items')` needs `shop_id` added: `.select('id, status, total, items, shop_id')`.
2. After the existing stock-decrement loop (same shape as above), add `await creditShopEarnings(order.id)`.

Add the same import.

### `lib/actions/products.ts::updateOrderStatus`

The existing order fetch (`select('is_preorder, items')`) needs `shop_id, payment_status` added: `select('is_preorder, items, shop_id, payment_status')`. After the existing `await admin.from('orders').update({ status }).eq('id', orderId)` succeeds, before the pre-order stock-decrement block, add:

```ts
if ((status === 'cancelled' || status === 'refunded') && order?.shop_id && order?.payment_status === 'paid') {
  await reverseShopEarnings(orderId)
}
```

Add `import { reverseShopEarnings } from '@/lib/wallet-ledger'` at the top.

---

## Seller-facing UI

### `app/seller/(shop)/wallet/page.tsx` — new file

Server component: calls `getWalletBalance()` and `getWalletTransactions()` in parallel, renders a balance stat card + a transaction table (date, order number if `order_id` present — link to `/admin`-style order reference isn't needed here since sellers don't have order detail pages yet, just show the order number text from the transaction `description`, type badge (credit=green/+, debit=red/−), amount). No pagination for v1 — matches the plan's YAGNI stance, transaction volume will be low early on.

### `components/seller/SellerSidebar.tsx` — modify

Add to `NAV`:

```ts
{ href: '/seller/wallet', label: 'Wallet', icon: Wallet },
```

(`Wallet` from `lucide-react`, already a dependency.)

---

## Error handling & edge cases

- **Double-crediting** (webhook and inline-callback both fire for the same order): the `(order_id, type)` unique constraint makes the second `creditShopEarnings` call a caught no-op — same idempotency guarantee level as the existing stock-decrement race handling, just via a DB constraint instead of the atomic `.eq('status','pending')` update trick (that trick already prevents `creditShopEarnings` from being called twice in the *stock* sense, but the ledger's own constraint is a second, independent safety net in case that ever changes).
- **Refund before ever being paid**: `reverseShopEarnings` no-ops if there's no existing credit row — an order that was cancelled while still `pending` never got credited, so there's nothing to reverse.
- **Partial refunds**: out of scope — `updateOrderStatus` only has whole-order `refunded`/`cancelled` states today, so the ledger only supports whole-order reversal, matching what the rest of the codebase supports.
- **Main-site orders**: `creditShopEarnings`/`reverseShopEarnings` both no-op immediately on `!order.shop_id` — zero behavior change for the checkout/admin flows that predate sub-project 1.
- **Negative or zero markup**: can't happen — `shop_products.markup_value >= 0` (sub-project 1's constraint) guarantees `item.price >= item.base_price` for every shop item, so credited amounts are always `>= 0`; the `if (amount <= 0) return` guard in `creditShopEarnings` additionally skips inserting a zero-value transaction (a shop item with exactly 0 markup shouldn't clutter the ledger with a GHS 0.00 row).

---

## Testing

- **Migration/constraint tests**: `wallet_transactions.amount > 0` check; unique `(order_id, type)` allows exactly one credit + one debit per order but multiple `order_id IS NULL` rows.
- **`wallet_balances` view test**: insert a credit and a debit for the same shop, confirm `balance` equals `credit − debit`.
- **`computeOrderEarnings` unit tests** (real, DB-free, run automatically): given a set of `OrderItem`s with `price`/`base_price`/`quantity`, the computed total matches `Σ (price − base_price) × quantity`; items with `base_price: null` (non-shop items) contribute 0; an empty array returns 0.
- **`creditShopEarnings`/`reverseShopEarnings` DB-integration behavior** (manual, same deferred-to-human pattern as sub-project 1's DB-touching pieces): idempotency (calling `creditShopEarnings` twice on the same order yields exactly one `credit` row), the `payment_status !== 'paid'` guard (calling it directly on a pending order is a no-op), the `status` guard on reversal (calling `reverseShopEarnings` on a still-paid, non-cancelled order is a no-op), and that reversal amount matches the original credit exactly.
- **Integration checkpoint** (manual, same deferred-to-human pattern as sub-project 1): place a real shop order end-to-end, confirm payment via Paystack test mode, verify `wallet_transactions` gets exactly one credit row for the right amount; mark it refunded via the admin panel, verify a matching debit appears and `wallet_balances.balance` returns to what it was before the order.

---

## File summary

| Action | File |
|--------|------|
| Create | `supabase/migrations/017_seller_wallet.sql` |
| Modify | `lib/supabase/types.ts` (add `wallet_transactions` table, `WalletTransaction` type, `OrderItem.base_price`) |
| Modify | `app/api/checkout/route.ts` (freeze `base_price` per item for shop orders) |
| Create | `lib/actions/wallet.ts` (client-facing reads, `'use server'`) |
| Create | `lib/wallet-earnings.ts` (pure calculation, unit-tested) |
| Create | `lib/wallet-ledger.ts` (server-only credit/reverse, never `'use server'`) |
| Modify | `app/api/payment/verify/route.ts` (call `creditShopEarnings`) |
| Modify | `app/api/webhooks/paystack/route.ts` (select `shop_id`, call `creditShopEarnings`) |
| Modify | `lib/actions/products.ts` (`updateOrderStatus` calls `reverseShopEarnings` on cancel/refund) |
| Create | `app/seller/(shop)/wallet/page.tsx` |
| Modify | `components/seller/SellerSidebar.tsx` (add Wallet nav item) |
