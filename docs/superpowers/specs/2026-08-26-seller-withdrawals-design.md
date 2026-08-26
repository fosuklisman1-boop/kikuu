# Seller Withdrawals — Design Spec

**Sub-project 4 (final piece) of the seller-shops initiative.** Builds on sub-project 3's wallet ledger (`wallet_transactions`, `wallet_balances`, `creditShopEarnings`/`reverseShopEarnings`). Turns a wallet balance a seller can only look at into money they can actually take out.

Also resolves the two gaps sub-project 3's final review found and deliberately parked rather than fixing on the spot:
- A refund issued only in the Paystack dashboard (not through the admin panel) never reverses a seller's credit.
- An admin who mistakenly cancels then un-cancels a paid shop order has no way to re-credit the seller short of raw SQL.

Both are resolved here by a general **manual wallet adjustment** tool for admins, rather than by building an automated Paystack refund-webhook handler (parked for a future decision — a webhook integration deserves its own design pass against real Paystack payloads, not an improvised addition to this spec).

## Goal

A seller with a positive wallet balance can request a withdrawal (paid out via MTN MoMo, entered once and saved to their shop). An admin sees pending requests, pays the seller manually outside the system, and marks the request paid — which debits the ledger. Admins can also reject a request, and can manually adjust any shop's wallet balance with a required reason for cases the automatic ledger can't reach on its own.

## Architecture

**Tech stack:** unchanged — Next.js 16, Supabase (Postgres + RLS), Zod, Vitest.

No payment API integration in this sub-project — withdrawals are **admin-processed manually**: the platform never initiates a payout itself. This keeps the sub-project's only new financial-integration surface at zero, appropriate for a first version. `withdrawal_requests` is a small state machine (`pending → paid` or `pending → rejected`) enforced by the same atomic `.eq('status', 'pending')` guard pattern already used everywhere in this codebase for payment-confirmation idempotency. A partial unique index limits a shop to one pending request at a time, which is also what makes "how much can I still withdraw" a simple subtraction rather than needing to reserve/release amounts.

The debit itself reuses sub-project 3's ledger machinery: a new `debitWalletForWithdrawal` function in `lib/wallet-ledger.ts` (the existing non-`'use server'` module — this function is only ever called from an already-`requireAdmin()`-gated action, so it doesn't need the "must never be an endpoint" treatment `creditShopEarnings`/`reverseShopEarnings` needed; it's there purely to keep all `wallet_transactions`-writing logic in one file, matching the existing convention) re-verifies the request is actually `paid` before writing, and a `(withdrawal_request_id)` unique constraint on `wallet_transactions` makes it idempotent the same way `(order_id, type)` already does for order-driven transactions.

## Database (migration `019_seller_withdrawals.sql`)

```sql
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

-- One pending request per shop at a time — this is also what keeps
-- "available balance" a plain subtraction rather than needing a
-- reserve/release mechanism.
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
```

Note: `unique (withdrawal_request_id)` with the column nullable is the same NULL-is-distinct idiom already used for `(order_id, type)` — every non-withdrawal transaction has `withdrawal_request_id = null` and those rows never conflict with each other; only a real withdrawal id is constrained to at most one debit.

## Type system (`lib/supabase/types.ts`)

Add to the `shops` table entry's `Row`: `momo_number: string | null`, `momo_name: string | null`.

Add `withdrawal_request_id: string | null` to the `wallet_transactions` table entry's `Row`.

New table entries:

```ts
withdrawal_settings: {
  Row: { id: boolean; min_amount: number; updated_at: string }
  Insert: Omit<Database['public']['Tables']['withdrawal_settings']['Row'], 'updated_at'>
  Update: Partial<Database['public']['Tables']['withdrawal_settings']['Insert']>
}
withdrawal_requests: {
  Row: {
    id: string
    shop_id: string
    amount: number
    momo_number: string
    momo_name: string
    status: 'pending' | 'paid' | 'rejected'
    admin_note: string | null
    requested_at: string
    processed_at: string | null
    processed_by: string | null
  }
  Insert: Omit<Database['public']['Tables']['withdrawal_requests']['Row'], 'id' | 'requested_at' | 'processed_at' | 'processed_by' | 'admin_note' | 'status'> & {
    status?: 'pending' | 'paid' | 'rejected'
  }
  Update: Partial<Database['public']['Tables']['withdrawal_requests']['Row']>
}
```

Convenience types:

```ts
export type WithdrawalSettings = Database['public']['Tables']['withdrawal_settings']['Row']
export type WithdrawalRequest = Database['public']['Tables']['withdrawal_requests']['Row']

export interface WithdrawalRequestWithShop extends WithdrawalRequest {
  shop: Pick<Shop, 'id' | 'name' | 'slug'>
}
```

## `lib/wallet-ledger.ts` — modify (existing, non-`'use server'` file)

Add:

```ts
export async function computeWithdrawableBalance(shopId: string): Promise<number> {
  const admin = createAdminClient()
  const [{ data: balanceRow }, { data: pending }] = await Promise.all([
    admin.from('wallet_balances').select('balance').eq('shop_id', shopId).maybeSingle(),
    admin.from('withdrawal_requests').select('amount').eq('shop_id', shopId).eq('status', 'pending').maybeSingle(),
  ])
  const balance = balanceRow?.balance ?? 0
  const pendingAmount = pending?.amount ?? 0
  return Math.max(0, balance - pendingAmount)
}

// Called only from markWithdrawalPaid (already requireAdmin()-gated). Re-verifies
// the request is actually 'paid' rather than trusting the caller, same discipline
// as creditShopEarnings/reverseShopEarnings.
export async function debitWalletForWithdrawal(withdrawalRequestId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: request, error } = await admin
    .from('withdrawal_requests')
    .select('shop_id, amount, status')
    .eq('id', withdrawalRequestId)
    .single()
  if (error) throw new Error(error.message)
  if (!request || request.status !== 'paid') return

  const { error: insertError } = await admin.from('wallet_transactions').insert({
    shop_id: request.shop_id,
    order_id: null,
    withdrawal_request_id: withdrawalRequestId,
    type: 'debit',
    amount: request.amount,
    description: 'Withdrawal payout',
  })
  if (insertError && insertError.code !== '23505') throw new Error(insertError.message)
}
```

## `lib/actions/wallet.ts` — modify (existing, `'use server'`)

Add:

```ts
export async function getWithdrawableBalance(): Promise<number> {
  const { shopId } = await requireShopOwner()
  return computeWithdrawableBalance(shopId)
}

export async function getWithdrawalSettings(): Promise<WithdrawalSettings> {
  const admin = createAdminClient()
  const { data } = await admin.from('withdrawal_settings').select('*').eq('id', true).single()
  return data ?? { id: true, min_amount: 50, updated_at: new Date().toISOString() }
}

export async function updateShopPayoutDetails(formData: FormData): Promise<{ error?: string }> {
  const { shopId } = await requireShopOwner()
  const momoNumber = String(formData.get('momo_number') ?? '').trim()
  const momoName = String(formData.get('momo_name') ?? '').trim()
  if (!/^0\d{9}$/.test(momoNumber)) return { error: 'Enter a valid 10-digit MoMo number (e.g. 0241234567).' }
  if (momoName.length < 2) return { error: 'Enter the name on the MoMo account.' }

  const admin = createAdminClient()
  const { error } = await admin.from('shops').update({ momo_number: momoNumber, momo_name: momoName }).eq('id', shopId)
  if (error) return { error: error.message }
  revalidatePath('/seller/wallet')
  return {}
}

export async function getMyWithdrawalRequests(): Promise<WithdrawalRequest[]> {
  const { shopId } = await requireShopOwner()
  const admin = createAdminClient()
  const { data } = await admin
    .from('withdrawal_requests')
    .select('*')
    .eq('shop_id', shopId)
    .order('requested_at', { ascending: false })
  return data ?? []
}
```

(Imports `computeWithdrawableBalance` from `@/lib/wallet-ledger`, `WithdrawalSettings`/`WithdrawalRequest` from `@/lib/supabase/types`.)

## `lib/actions/withdrawals.ts` — new file, `'use server'`

```ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireShopOwner } from '@/lib/auth/require-shop-owner'
import { computeWithdrawableBalance, debitWalletForWithdrawal } from '@/lib/wallet-ledger'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { WithdrawalRequestWithShop } from '@/lib/supabase/types'

const AmountSchema = z.coerce.number().positive()

export async function requestWithdrawal(formData: FormData): Promise<{ error?: string }> {
  const { shopId } = await requireShopOwner()
  const admin = createAdminClient()

  const { data: shop } = await admin.from('shops').select('momo_number, momo_name').eq('id', shopId).single()
  if (!shop?.momo_number || !shop?.momo_name) {
    return { error: 'Add your MoMo details before requesting a withdrawal.' }
  }

  const parsedAmount = AmountSchema.safeParse(formData.get('amount'))
  if (!parsedAmount.success) return { error: 'Enter a valid amount.' }
  const amount = parsedAmount.data

  const { data: settings } = await admin.from('withdrawal_settings').select('min_amount').eq('id', true).single()
  const minAmount = settings?.min_amount ?? 0
  if (amount < minAmount) return { error: `Minimum withdrawal is GHS ${minAmount.toFixed(2)}.` }

  const available = await computeWithdrawableBalance(shopId)
  if (amount > available) return { error: 'Amount exceeds your available balance.' }

  const { error } = await admin.from('withdrawal_requests').insert({
    shop_id: shopId,
    amount,
    momo_number: shop.momo_number,
    momo_name: shop.momo_name,
  })
  if (error) {
    if (error.code === '23505') return { error: 'You already have a pending withdrawal request.' }
    return { error: error.message }
  }

  revalidatePath('/seller/wallet')
  return {}
}

export async function getPendingWithdrawalRequests(): Promise<WithdrawalRequestWithShop[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const { data } = await admin
    .from('withdrawal_requests')
    .select('*, shop:shops(id, name, slug)')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
  return (data ?? []) as unknown as WithdrawalRequestWithShop[]
}

export async function getWithdrawalHistory(): Promise<WithdrawalRequestWithShop[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const { data } = await admin
    .from('withdrawal_requests')
    .select('*, shop:shops(id, name, slug)')
    .neq('status', 'pending')
    .order('processed_at', { ascending: false })
    .limit(100)
  return (data ?? []) as unknown as WithdrawalRequestWithShop[]
}

export async function markWithdrawalPaid(requestId: string): Promise<{ error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: updated, error } = await admin
    .from('withdrawal_requests')
    .update({ status: 'paid', processed_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id')

  if (error) return { error: error.message }
  if (!updated || updated.length === 0) return { error: 'This request was already processed.' }

  await debitWalletForWithdrawal(requestId)
  revalidatePath('/admin/withdrawals')
  return {}
}

export async function rejectWithdrawal(requestId: string, reason: string): Promise<{ error?: string }> {
  await requireAdmin()
  if (!reason.trim()) return { error: 'A reason is required.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('withdrawal_requests')
    .update({ status: 'rejected', admin_note: reason, processed_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (error) return { error: error.message }
  revalidatePath('/admin/withdrawals')
  return {}
}

export async function updateMinWithdrawalAmount(minAmount: number): Promise<{ error?: string }> {
  await requireAdmin()
  if (!Number.isFinite(minAmount) || minAmount < 0) return { error: 'Enter a valid amount.' }

  const admin = createAdminClient()
  const { error } = await admin.from('withdrawal_settings').update({ min_amount: minAmount }).eq('id', true)
  if (error) return { error: error.message }
  revalidatePath('/admin/withdrawals')
  return {}
}

// Manual wallet adjustment — the in-app remedy for the two gaps parked during
// sub-project 3's review (a refund processed only in the Paystack dashboard;
// an order that was wrongly cancelled and un-cancelled).
export async function adjustWalletBalance(
  shopSlug: string,
  type: 'credit' | 'debit',
  amount: number,
  reason: string
): Promise<{ error?: string }> {
  await requireAdmin()
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter a valid amount.' }
  if (!reason.trim()) return { error: 'A reason is required for every manual adjustment.' }

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('id').eq('slug', shopSlug).single()
  if (!shop) return { error: 'No shop found with that URL slug.' }

  const { error } = await admin.from('wallet_transactions').insert({
    shop_id: shop.id,
    order_id: null,
    withdrawal_request_id: null,
    type,
    amount,
    description: `Manual adjustment: ${reason}`,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/withdrawals')
  return {}
}
```

## `lib/actions/shops-admin.ts` — new file, `'use server'`

```ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'
import type { Shop } from '@/lib/supabase/types'

export interface ShopWithStats extends Shop {
  owner_email: string | null
  product_count: number
}

export async function getAllShops(): Promise<ShopWithStats[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: shops } = await admin.from('shops').select('*').order('created_at', { ascending: false })
  if (!shops || shops.length === 0) return []

  // public.users has no email column (it only mirrors id/role — see
  // supabase/migrations/005_public_users.sql). Email lives in auth.users,
  // which isn't exposed over PostgREST even to the service-role client —
  // the Admin Auth API is the correct way to read it.
  const [{ data: userPage }, { data: counts }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('shop_products').select('shop_id').in('shop_id', shops.map((s) => s.id)),
  ])

  const emailByOwner = new Map((userPage?.users ?? []).map((u) => [u.id, u.email ?? null]))
  const countByShop = new Map<string, number>()
  for (const row of counts ?? []) {
    countByShop.set(row.shop_id, (countByShop.get(row.shop_id) ?? 0) + 1)
  }

  return shops.map((s) => ({
    ...s,
    owner_email: emailByOwner.get(s.owner_id) ?? null,
    product_count: countByShop.get(s.id) ?? 0,
  }))
}

export async function toggleShopActive(shopId: string, active: boolean): Promise<{ error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('shops').update({ active }).eq('id', shopId)
  if (error) return { error: error.message }
  revalidatePath('/admin/shops')
  return {}
}
```

## Seller UI: `/seller/wallet` — modify (existing page from sub-project 3)

Add, above the existing balance card:
- If `momo_number`/`momo_name` aren't set on the shop: a small form (two inputs, "Save") calling `updateShopPayoutDetails`.
- If set: display them plainly with an "Edit" link that reveals the same form pre-filled.

Add, below the balance card:
- A second stat: "Available to withdraw" from `getWithdrawableBalance()` (distinct from "Total balance" — they differ only when a request is pending).
- If there's a pending request (from `getMyWithdrawalRequests()`, filter client-side or add a small `getMyPendingWithdrawal()` — reuse `getMyWithdrawalRequests` and find the pending one, no new action needed): show "Withdrawal of {amount} pending since {date}" instead of a request form.
- Otherwise: a small form (amount input, "Request Withdrawal" button) calling `requestWithdrawal`, disabled if payout details aren't set yet.
- A "Withdrawal history" section below the existing transaction table: `getMyWithdrawalRequests()` rendered as a small table (date, amount, status badge, admin note if rejected).

## Admin UI: `app/admin/withdrawals/page.tsx` — new file

Server component fetching `getPendingWithdrawalRequests()`, `getWithdrawalHistory()`, and current `getWithdrawalSettings()` (from `lib/actions/wallet.ts`) in parallel. Renders:
- An editable "Minimum withdrawal amount" field (calls `updateMinWithdrawalAmount`).
- Pending requests table: shop name/slug, amount, MoMo number/name, requested date, "Mark Paid" / "Reject" buttons (reject opens a small reason prompt).
- History table (last 100): shop, amount, status, processed date, admin note.
- A "Manual Adjustment" form: shop slug input, credit/debit toggle, amount, reason — calls `adjustWalletBalance`.

## Admin UI: `app/admin/shops/page.tsx` — new file

Server component calling `getAllShops()`. Table: shop name, slug (linked to `/shop/[slug]`), owner email, product count, created date, active/suspended badge with a toggle button calling `toggleShopActive`.

## Admin nav: `components/admin/AdminSidebar.tsx` — modify

Add two entries to `NAV`, e.g. after the existing `Users` entry: `{ href: '/admin/shops', label: 'Shops', icon: Store }` and `{ href: '/admin/withdrawals', label: 'Withdrawals', icon: Banknote }` (both from `lucide-react`).

## Error handling & edge cases

- **Double "Mark Paid" click**: the atomic `.eq('status', 'pending')` update means only the first click's update matches any rows; the second returns the "already processed" error. `debitWalletForWithdrawal`'s own `(withdrawal_request_id)` unique constraint is a second, independent line of defense.
- **Requesting more than available**: checked against `computeWithdrawableBalance` (total balance minus any pending request), not raw `wallet_balances.balance` — a seller can't stack multiple requests past their real balance.
- **Amount below minimum**: rejected with the current configured minimum in the error message.
- **Rejected request**: no ledger entry at all — balance is completely unaffected, and the one-pending-per-shop constraint clears immediately so the seller can submit a new request.
- **Manual adjustment on a nonexistent shop slug**: rejected with a clear error before any DB write.
- **Payout details required before requesting**: enforced server-side in `requestWithdrawal`, not just hidden in the UI (a resubmission via dev tools without saved MoMo details still fails cleanly).

## Testing

- **Migration/constraint tests**: `withdrawal_requests.amount > 0`; the partial unique index actually blocks a second `pending` row for the same shop but allows multiple `paid`/`rejected` rows; `wallet_transactions.withdrawal_request_id` unique constraint blocks a second debit for the same request.
- **`computeWithdrawableBalance` behavior** (manual, DB-dependent — no pure-function extraction needed here since it's inherently two live queries, unlike `computeOrderEarnings`): with a balance of 100 and a pending request of 30, returns 70; with no pending request, returns the full balance; never returns negative.
- **State machine tests** (manual): `markWithdrawalPaid` on an already-`paid` request is a no-op returning the "already processed" error; `rejectWithdrawal` requires a non-empty reason; both correctly no-op on a request that isn't `pending`.
- **Integration checkpoint** (manual, same deferred-to-human pattern as prior sub-projects): seller sets MoMo details, requests a withdrawal, admin sees it in `/admin/withdrawals`, marks it paid, confirms a debit appears in `wallet_transactions` with the right `withdrawal_request_id`, and the seller's `/seller/wallet` balance drops accordingly. Separately: admin uses the manual adjustment form on a real shop slug, confirms a correctly-described transaction appears.

## File summary

| Action | File |
|--------|------|
| Create | `supabase/migrations/019_seller_withdrawals.sql` |
| Modify | `lib/supabase/types.ts` |
| Modify | `lib/wallet-ledger.ts` |
| Modify | `lib/actions/wallet.ts` |
| Create | `lib/actions/withdrawals.ts` |
| Create | `lib/actions/shops-admin.ts` |
| Modify | `app/seller/(shop)/wallet/page.tsx` |
| Create | `app/admin/withdrawals/page.tsx` |
| Create | `app/admin/shops/page.tsx` |
| Modify | `components/admin/AdminSidebar.tsx` |

## Explicitly out of scope (flagged, not built here)

- Automated payout via Paystack Transfers or any other payment API — this sub-project is manual-only by design.
- An automated Paystack refund webhook that auto-reverses credits — resolved instead by the manual adjustment tool; a real webhook integration is a future decision, not built here.
- Bank-account payout option — MoMo only, matching the existing "MTN MoMo primary payment" convention.
