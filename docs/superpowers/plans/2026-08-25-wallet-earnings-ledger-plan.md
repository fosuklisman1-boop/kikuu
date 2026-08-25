# Order Attribution & Earnings Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a shop-attributed order's payment is confirmed, credit the seller's wallet with 100% of their markup on that order; reverse the credit if the order is later cancelled/refunded. Sellers see a running balance and transaction history at `/seller/wallet`.

**Architecture:** An append-only `wallet_transactions` ledger is the only source of truth; balance is always computed live via a `wallet_balances` view, never cached. A `(order_id, type)` unique constraint makes crediting/reversing idempotent against this codebase's existing dual payment-confirmation race (Paystack inline callback vs. webhook). `creditShopEarnings`/`reverseShopEarnings` live in a plain, non-`'use server'` module so they can never become client-callable endpoints, and each independently re-verifies its own precondition (`payment_status === 'paid'` / `status IN ('cancelled','refunded')`) rather than trusting its caller.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), Zod, Vitest — unchanged from sub-project 1.

**Spec:** [docs/superpowers/specs/2026-08-25-wallet-earnings-ledger-design.md](../specs/2026-08-25-wallet-earnings-ledger-design.md)

## Global Constraints

- Seller keeps 100% of markup — no platform commission in this sub-project.
- Credit happens on `payment_status === 'paid'`, never on order creation.
- A `cancelled`/`refunded` order with a prior credit gets an automatic reversal debit for the exact original amount (never recomputed).
- `creditShopEarnings` and `reverseShopEarnings` must NEVER be exported from a `'use server'` file — they are server-only functions callable only by other server-side code, not endpoints. Each must independently re-verify its own precondition before acting, regardless of what triggered the call.
- Main-site (non-shop) orders must see zero behavior change — every wallet function no-ops immediately on `!order.shop_id`.
- This repo's test runner (Vitest) covers pure logic only; DB-integration behavior (the actual credit/reverse against a live database) is manually verified by a human with live Supabase access, same deferred-verification pattern as sub-project 1.

---

### Task 1: Migration — `wallet_transactions`, `wallet_balances`, `orders.items.base_price`

**Files:**
- Create: `supabase/migrations/017_seller_wallet.sql`

**Interfaces:**
- Produces: table `public.wallet_transactions` (`id, shop_id, order_id, type, amount, description, created_at`) and view `public.wallet_balances` (`shop_id, balance`). All later tasks depend on these exact names/columns. (`orders.items.base_price` is a JSONB field, not a DB schema change — added in Task 2/3.)

- [ ] **Step 1: Write the migration**

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
```

- [ ] **Step 2: Apply the migration**

Open your Supabase project's dashboard → SQL Editor, paste the full contents of `supabase/migrations/017_seller_wallet.sql`, and run it. Expected: "Success. No rows returned."

- [ ] **Step 3: Manually verify constraints**

Run each of these in the SQL Editor (replace `<shop-id>` with a real `shops.id` from `select id from public.shops limit 1;`, and `<order-id>` with a real `orders.id`):

```sql
-- amount must be positive
insert into public.wallet_transactions (shop_id, order_id, type, amount, description)
  values ('<shop-id>', null, 'credit', 0, 'test'); -- should fail: check constraint

-- valid credit succeeds
insert into public.wallet_transactions (shop_id, order_id, type, amount, description)
  values ('<shop-id>', '<order-id>', 'credit', 15.50, 'test credit');

-- second credit for the SAME order must fail (unique violation on (order_id, type))
insert into public.wallet_transactions (shop_id, order_id, type, amount, description)
  values ('<shop-id>', '<order-id>', 'credit', 5.00, 'duplicate test');

-- a debit for the same order is allowed (different type)
insert into public.wallet_transactions (shop_id, order_id, type, amount, description)
  values ('<shop-id>', '<order-id>', 'debit', 15.50, 'test reversal');

-- balance view reflects both rows
select * from public.wallet_balances where shop_id = '<shop-id>';
-- Expected: balance = 0 (15.50 credit - 15.50 debit)

-- multiple null-order_id rows are allowed (future withdrawal debits, not constrained)
insert into public.wallet_transactions (shop_id, order_id, type, amount, description)
  values ('<shop-id>', null, 'debit', 1.00, 'null-order test 1');
insert into public.wallet_transactions (shop_id, order_id, type, amount, description)
  values ('<shop-id>', null, 'debit', 1.00, 'null-order test 2');
-- Expected: both succeed

-- Clean up test rows
delete from public.wallet_transactions where description like '%test%';
```

Expected: the two marked inserts fail with the stated error; everything else succeeds and the view computes correctly.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/017_seller_wallet.sql
git commit -m "feat: add wallet_transactions ledger and wallet_balances view"
```

---

### Task 2: Type system — `WalletTransaction`, `OrderItem.base_price`

**Files:**
- Modify: `lib/supabase/types.ts`

**Interfaces:**
- Produces: `WalletTransaction` type, `OrderItem.base_price: number | null` field. Used by Tasks 3-8.

- [ ] **Step 1: Add the table entry**

Inside the `Database['public']['Tables']` interface, alongside `shops`/`shop_products`, add:

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

- [ ] **Step 2: Add the convenience type**

At the bottom of the file, alongside `export type Shop = ...`:

```ts
export type WalletTransaction = Database['public']['Tables']['wallet_transactions']['Row']
```

- [ ] **Step 3: Add `base_price` to the existing `OrderItem` interface**

Find the existing `OrderItem` interface and add `base_price: number | null` as a required field (right after `price: number`):

```ts
export interface OrderItem {
  product_id: string
  product_name: string
  product_image: string
  price: number
  base_price: number | null
  quantity: number
  is_preorder: boolean
  preorder_ship_date: string | null
  preorder_note: string | null
  selected_color?: { name: string; hex: string }
  selected_size?: string
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: This WILL fail at this point — `app/api/checkout/route.ts` is the only place that constructs an `OrderItem` object literal, and it doesn't set `base_price` yet. That's expected; Task 3 fixes it. Confirm the error is specifically about `base_price` missing in `app/api/checkout/route.ts`'s `orderItems.push({...})` call, not something else.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: add WalletTransaction type and OrderItem.base_price field"
```

---

### Task 3: Checkout — freeze `base_price` for shop orders

**Files:**
- Modify: `app/api/checkout/route.ts`

**Interfaces:**
- Consumes: `OrderItem.base_price` (Task 2).
- Produces: every constructed `OrderItem` now has `base_price` set (a number for shop orders, `null` for main-site orders) — this is what Task 4's `computeOrderEarnings` reads.

- [ ] **Step 1: Modify the shop-pricing block**

Find (around line 78-91):

```ts
const shopPriceMap = new Map<string, number>()
if (shop_id) {
  const { data: shopRow } = await admin.from('shops').select('id, active').eq('id', shop_id).single()
  if (!shopRow || !shopRow.active) {
    return NextResponse.json({ error: 'This shop is not available.' }, { status: 400 })
  }
  const { data: shopProducts } = await admin
    .from('shop_products_priced')
    .select('product_id, shop_price')
    .eq('shop_id', shop_id)
    .in('product_id', productIds)
  for (const sp of shopProducts ?? []) {
    shopPriceMap.set(sp.product_id, sp.shop_price)
  }
}
```

Replace with (adds a second map and fetches `base_price` alongside `shop_price`):

```ts
const shopPriceMap = new Map<string, number>()
const shopBasePriceMap = new Map<string, number>()
if (shop_id) {
  const { data: shopRow } = await admin.from('shops').select('id, active').eq('id', shop_id).single()
  if (!shopRow || !shopRow.active) {
    return NextResponse.json({ error: 'This shop is not available.' }, { status: 400 })
  }
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

- [ ] **Step 2: Add `base_price` to the `orderItems.push({...})` call**

Find the `orderItems.push({...})` block (around line 130-141) — it currently has a line `price: shop_id ? shopPriceMap.get(product.id)! : (flashPrices.get(product.id) ?? product.price),`. Add a new line directly after it:

```ts
base_price: shop_id ? shopBasePriceMap.get(product.id)! : null,
```

The non-null assertion is safe by the same invariant as the adjacent `shopPriceMap.get(product.id)!` — both are guarded by the earlier `if (shop_id && !shopPriceMap.has(product.id))` membership check in the same loop iteration (a product present in `shopPriceMap` is always present in `shopBasePriceMap` too, since both maps are populated from the same query's rows in the same loop).

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean (the error from Task 2 Step 4 is now resolved).

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: 17/17 passing, no regressions (this task doesn't touch any tested logic directly, but confirms nothing broke).

- [ ] **Step 5: Manually verify (deferred — no live DB in a sandboxed environment)**

If you have live Supabase + Paystack test access: place a shop order, then `select items from public.orders where id = '<order-id>';` and confirm each item's `base_price` matches that product's actual base price at the time, and is `null` for a main-site order's items.

- [ ] **Step 6: Commit**

```bash
git add app/api/checkout/route.ts
git commit -m "feat: freeze base_price per item for shop-attributed orders"
```

---

### Task 4: `computeOrderEarnings` pure helper

**Files:**
- Create: `lib/wallet-earnings.ts`
- Create: `lib/wallet-earnings.test.ts`

**Interfaces:**
- Consumes: `OrderItem` type (Task 2).
- Produces: `computeOrderEarnings(items: OrderItem[]): number`. Used by `lib/wallet-ledger.ts` (Task 5).

- [ ] **Step 1: Write the failing test**

```ts
// lib/wallet-earnings.test.ts
import { describe, it, expect } from 'vitest'
import { computeOrderEarnings } from './wallet-earnings'
import type { OrderItem } from './supabase/types'

function item(overrides: Partial<OrderItem>): OrderItem {
  return {
    product_id: 'p1',
    product_name: 'Test Product',
    product_image: '',
    price: 60,
    base_price: 50,
    quantity: 1,
    is_preorder: false,
    preorder_ship_date: null,
    preorder_note: null,
    ...overrides,
  }
}

describe('computeOrderEarnings', () => {
  it('computes markup times quantity for a single shop item', () => {
    expect(computeOrderEarnings([item({ price: 60, base_price: 50, quantity: 2 })])).toBe(20)
  })

  it('sums earnings across multiple items', () => {
    expect(computeOrderEarnings([
      item({ price: 60, base_price: 50, quantity: 1 }),
      item({ price: 30, base_price: 25, quantity: 3 }),
    ])).toBe(25) // 10 + 15
  })

  it('contributes 0 for items with base_price null (non-shop items)', () => {
    expect(computeOrderEarnings([item({ price: 60, base_price: null, quantity: 1 })])).toBe(0)
  })

  it('returns 0 for an empty order', () => {
    expect(computeOrderEarnings([])).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/wallet-earnings.test.ts`
Expected: FAIL — `Cannot find module './wallet-earnings'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/wallet-earnings.ts
import type { OrderItem } from '@/lib/supabase/types'

export function computeOrderEarnings(items: OrderItem[]): number {
  return items.reduce(
    (sum, item) => sum + (item.base_price !== null ? (item.price - item.base_price) * item.quantity : 0),
    0
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/wallet-earnings.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/wallet-earnings.ts lib/wallet-earnings.test.ts
git commit -m "feat: add computeOrderEarnings pure pricing helper"
```

---

### Task 5: Wallet ledger + client-facing reads

**Files:**
- Create: `lib/wallet-ledger.ts` — server-only, **not** `'use server'`
- Create: `lib/actions/wallet.ts` — `'use server'`, client-facing reads only

**Interfaces:**
- Consumes: `computeOrderEarnings` (Task 4), `requireShopOwner()` (existing, from sub-project 1), `createAdminClient` (existing).
- Produces: `creditShopEarnings(orderId: string): Promise<void>`, `reverseShopEarnings(orderId: string): Promise<void>` (Task 6/7 call these), `getWalletBalance(): Promise<number>`, `getWalletTransactions(): Promise<WalletTransaction[]>` (Task 8 calls these).

- [ ] **Step 1: Create `lib/wallet-ledger.ts`**

**Do not add `'use server'` to this file.** It must never become a callable endpoint — it's imported only by Route Handlers and Server Actions, never by a Client Component.

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

  if (!order?.shop_id) return
  if (order.payment_status !== 'paid') return

  const amount = computeOrderEarnings((order.items as OrderItem[]) ?? [])
  if (amount <= 0) return

  const { error } = await admin.from('wallet_transactions').insert({
    shop_id: order.shop_id,
    order_id: orderId,
    type: 'credit',
    amount,
    description: `Earnings from order ${order.order_number}`,
  })
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

  if (!credit) return

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

- [ ] **Step 2: Create `lib/actions/wallet.ts`**

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

- [ ] **Step 3: Verify it compiles and the suite still passes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean, 21/21 tests passing (17 pre-existing + 4 from Task 4).

- [ ] **Step 4: Manually verify (deferred — no live DB in a sandboxed environment)**

If you have live Supabase access: with a real paid shop order, call `creditShopEarnings(orderId)` twice (e.g. via a one-off script) and confirm exactly one `credit` row exists after both calls. Call `creditShopEarnings` on a `pending` (unpaid) order and confirm no row is inserted. Call `reverseShopEarnings` on an order that's still `paid` (not cancelled/refunded) and confirm no row is inserted.

- [ ] **Step 5: Commit**

```bash
git add lib/wallet-ledger.ts lib/actions/wallet.ts
git commit -m "feat: add wallet ledger crediting/reversal and client-facing reads"
```

---

### Task 6: Wire crediting into both payment-confirmation paths

**Files:**
- Modify: `app/api/payment/verify/route.ts`
- Modify: `app/api/webhooks/paystack/route.ts`

**Interfaces:**
- Consumes: `creditShopEarnings` (Task 5).

This is one task covering two files because both edits are the same shape (add an import, add one function call at the same structural point) — batching avoids two near-identical review passes for a two-line change each.

- [ ] **Step 1: Modify `app/api/payment/verify/route.ts`**

Add to the imports:

```ts
import { creditShopEarnings } from '@/lib/wallet-ledger'
```

Inside `processVerification`, find the block:

```ts
if (updated && updated.length > 0) {
  await admin.from('order_events').insert({
    order_id: orderId,
    event: 'Payment Confirmed',
    description: `Payment received via ${result.channel}.`,
  })

  const items = order.items as any[]
  for (const item of items) {
    if (!item.is_preorder) {
      await admin.rpc('decrement_stock', {
        p_product_id: item.product_id,
        p_qty: item.quantity,
      })
    }
  }
}
```

Add one line at the end of that `if` block:

```ts
if (updated && updated.length > 0) {
  await admin.from('order_events').insert({
    order_id: orderId,
    event: 'Payment Confirmed',
    description: `Payment received via ${result.channel}.`,
  })

  const items = order.items as any[]
  for (const item of items) {
    if (!item.is_preorder) {
      await admin.rpc('decrement_stock', {
        p_product_id: item.product_id,
        p_qty: item.quantity,
      })
    }
  }

  await creditShopEarnings(orderId)
}
```

- [ ] **Step 2: Modify `app/api/webhooks/paystack/route.ts`**

Add to the imports:

```ts
import { creditShopEarnings } from '@/lib/wallet-ledger'
```

Change the order lookup's select list from:

```ts
.select('id, status, total, items')
```

to:

```ts
.select('id, status, total, items, shop_id')
```

Then, after the existing stock-decrement loop at the end of the `if (event.event === 'charge.success')` block, add one line:

```ts
    const items = order.items as { product_id: string; quantity: number; is_preorder: boolean }[]
    for (const item of items) {
      if (!item.is_preorder) {
        await admin.rpc('decrement_stock', {
          p_product_id: item.product_id,
          p_qty: item.quantity,
        })
      }
    }

    await creditShopEarnings(order.id)
  }
```

- [ ] **Step 3: Verify it compiles and the suite still passes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean, 21/21 tests passing.

- [ ] **Step 4: Manually verify (deferred — no live DB/Paystack in a sandboxed environment)**

If you have live access: complete a real shop order's Paystack payment via both paths if possible (inline popup and, separately, by letting the webhook fire), confirm `wallet_transactions` gets exactly one `credit` row either way — never two.

- [ ] **Step 5: Commit**

```bash
git add app/api/payment/verify/route.ts app/api/webhooks/paystack/route.ts
git commit -m "feat: credit shop earnings on payment confirmation"
```

---

### Task 7: Wire reversal into admin order-status updates

**Files:**
- Modify: `lib/actions/products.ts`

**Interfaces:**
- Consumes: `reverseShopEarnings` (Task 5).

- [ ] **Step 1: Modify `updateOrderStatus`**

Add to the imports:

```ts
import { reverseShopEarnings } from '@/lib/wallet-ledger'
```

Change the order-fetch select list from:

```ts
.select('is_preorder, items')
```

to:

```ts
.select('is_preorder, items, shop_id, payment_status')
```

After the existing `if (error) return { error: error.message }` line (right after the `orders.update({ status })` call) and before the `order_events` insert, add:

```ts
if ((status === 'cancelled' || status === 'refunded') && order?.shop_id && order?.payment_status === 'paid') {
  await reverseShopEarnings(orderId)
}
```

- [ ] **Step 2: Verify it compiles and the suite still passes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean, 21/21 tests passing.

- [ ] **Step 3: Manually verify (deferred — no live DB in a sandboxed environment)**

If you have live access: mark a paid shop order as `refunded` via the admin panel, confirm a `debit` transaction appears for the exact credited amount and `wallet_balances.balance` decreases accordingly. Mark a *main-site* (non-shop) order as `refunded` and confirm no wallet activity occurs at all (it should behave exactly as it did before this task).

- [ ] **Step 4: Commit**

```bash
git add lib/actions/products.ts
git commit -m "feat: reverse shop earnings when a paid order is cancelled or refunded"
```

---

### Task 8: Seller wallet page + sidebar nav item

**Files:**
- Create: `app/seller/(shop)/wallet/page.tsx`
- Modify: `components/seller/SellerSidebar.tsx`

**Interfaces:**
- Consumes: `getWalletBalance`, `getWalletTransactions` (Task 5).

- [ ] **Step 1: Create the wallet page**

```tsx
export const dynamic = 'force-dynamic'
import { getWalletBalance, getWalletTransactions } from '@/lib/actions/wallet'
import { formatGHS } from '@/lib/utils'

export default async function SellerWalletPage() {
  const [balance, transactions] = await Promise.all([
    getWalletBalance(),
    getWalletTransactions(),
  ])

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Wallet</h1>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8 max-w-sm">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Available balance</p>
        <p className="text-3xl font-bold text-gray-900">{formatGHS(balance)}</p>
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Transaction history</h2>

      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No transactions yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Description</th>
              <th className="py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-gray-100">
                <td className="py-3 pr-4 text-gray-500">
                  {new Date(tx.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="py-3 pr-4 text-gray-800">{tx.description}</td>
                <td className={`py-3 font-semibold ${tx.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.type === 'credit' ? '+' : '−'}{formatGHS(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add "Wallet" to `SellerSidebar`'s nav**

Find the `NAV` array:

```ts
const NAV = [
  { href: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/seller/products', label: 'Products', icon: Package },
]
```

Change to:

```ts
const NAV = [
  { href: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/seller/products', label: 'Products', icon: Package },
  { href: '/seller/wallet', label: 'Wallet', icon: Wallet },
]
```

Add `Wallet` to the existing `lucide-react` import line (`import { LayoutDashboard, Package, LogOut, ExternalLink, Menu, X } from 'lucide-react'` becomes `import { LayoutDashboard, Package, LogOut, ExternalLink, Menu, X, Wallet } from 'lucide-react'`).

- [ ] **Step 3: Verify it compiles and the suite still passes**

Run: `npx tsc --noEmit && npx vitest run && npx eslint "app/seller/(shop)/wallet/page.tsx" components/seller/SellerSidebar.tsx`
Expected: tsc clean, 21/21 tests passing, no new lint errors.

- [ ] **Step 4: Manually verify (deferred — no live DB in a sandboxed environment)**

If you have live access: log in as a seller with at least one credited order, visit `/seller/wallet`, confirm the balance and transaction row match what's in `wallet_transactions`. Confirm the mobile drawer nav (added for the seller area in an earlier fix) includes the new Wallet link.

- [ ] **Step 5: Commit**

```bash
git add "app/seller/(shop)/wallet/page.tsx" components/seller/SellerSidebar.tsx
git commit -m "feat: add seller wallet page and nav entry"
```

---

### Task 9: Final end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full happy-path walkthrough** (requires live Supabase with migrations 016 and 017 applied, and live Paystack test credentials)

1. As a seller with an existing curated product, note the shop price and base price.
2. As a customer, buy that product through the shop, complete Paystack test payment.
3. Confirm `wallet_transactions` has exactly one `credit` row for `(shop_price - base_price) * quantity`.
4. Visit `/seller/wallet` as that seller, confirm the balance and the transaction row both match.
5. As an admin, mark that order `refunded`.
6. Confirm a matching `debit` row appears for the identical amount, and `/seller/wallet`'s balance returns to what it was before the order.

- [ ] **Step 2: Regression check**

1. Buy a product from the main site (not a shop) end-to-end — confirm no `wallet_transactions` row is created at all.
2. Mark a main-site order `refunded` — confirm no wallet activity occurs.
3. Re-run the sub-project 1 happy-path checklist (create shop → curate → storefront → checkout) to confirm nothing regressed.

- [ ] **Step 3: Idempotency spot check**

If your Paystack test setup lets you trigger both the inline callback and the webhook for the same transaction, confirm only one `credit` row results. Otherwise, simulate by calling `creditShopEarnings(orderId)` twice directly against a real paid shop order (e.g. via a one-off script using the service role key) and confirm still only one row.

- [ ] **Step 4: No commit expected** unless verification surfaces a bug, in which case fix it, verify, and commit normally.
