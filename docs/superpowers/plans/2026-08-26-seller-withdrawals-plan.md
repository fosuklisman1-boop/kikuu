# Seller Withdrawals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A seller with a positive wallet balance can request a withdrawal (paid via MTN MoMo, saved once on their shop). An admin sees pending requests in `/admin/withdrawals`, pays manually outside the system, and marks the request paid — which debits the ledger. Admins can also reject a request, manually adjust any shop's wallet with a required reason, and browse/suspend shops from a new `/admin/shops` page.

**Architecture:** No payment-API integration — withdrawals are admin-processed manually, so the only new financial surface is a small `pending → paid`/`rejected` state machine on `withdrawal_requests`, guarded by the same atomic `.eq('status', 'pending')` pattern already used throughout this codebase for payment-confirmation idempotency. The actual ledger debit reuses `lib/wallet-ledger.ts` (the existing non-`'use server'` module from the wallet sub-project) and re-verifies its own precondition before writing, same discipline as `creditShopEarnings`/`reverseShopEarnings`. A manual wallet-adjustment action gives admins an in-app remedy for the two gaps parked during that sub-project's final review, instead of an unreviewed Paystack refund-webhook integration.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), Zod, Vitest — unchanged.

**Spec:** [docs/superpowers/specs/2026-08-26-seller-withdrawals-design.md](../specs/2026-08-26-seller-withdrawals-design.md)

## Global Constraints

- No payment API integration in this sub-project — every payout is manual, admin-processed outside the app.
- A shop may have at most one `pending` withdrawal request at a time (DB-enforced via a partial unique index).
- "Available to withdraw" = wallet balance minus any currently-pending request amount — never the raw balance.
- Every exported Zod schema object lives in a plain (non-`'use server'`) module, never inline-exported from a `'use server'` action file — this is the exact class of bug that broke the production build in an earlier sub-project (Next.js requires every export from a `'use server'` file to be an async function). This plan's schemas are all unexported module-level `const`s inside their action files, which is safe — but if any task needs to export a schema for testing, it must go in its own plain file.
- Every mutating admin action calls `requireAdmin()` first; every mutating seller action calls `requireShopOwner()` first — matching the established pattern, no exceptions.
- This repo's test runner covers pure logic only. `computeWithdrawableBalance`/`debitWalletForWithdrawal` are inherently DB-dependent (no pure-function extraction applies here, unlike `computeOrderEarnings`) — their correctness is manually verified by a human with live Supabase access, same deferred pattern as prior sub-projects.
- **Before any task that touches a `'use server'` file, run `npm run build` (not just `tsc --noEmit`) at least once before declaring the task done** — this is the only check that catches the export-shape violation class of bug; `tsc`/`vitest` do not.

---

### Task 1: Migration — payout details, withdrawal settings/requests, ledger linkage

**Files:**
- Create: `supabase/migrations/019_seller_withdrawals.sql`

**Interfaces:**
- Produces: `shops.momo_number`/`shops.momo_name` columns, table `public.withdrawal_settings` (singleton), table `public.withdrawal_requests`, `wallet_transactions.withdrawal_request_id` column. All later tasks depend on these exact names.

- [ ] **Step 1: Write the migration**

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

- [ ] **Step 2: Apply the migration**

Open your Supabase project's dashboard → SQL Editor, paste the full contents of `supabase/migrations/019_seller_withdrawals.sql`, and run it. Expected: "Success. No rows returned."

- [ ] **Step 3: Manually verify constraints**

Run each of these in the SQL Editor (replace `<shop-id>` with a real `shops.id`):

```sql
-- singleton settings row exists with the default
select * from public.withdrawal_settings;
-- Expected: exactly 1 row, min_amount = 50.00

-- a second row must fail (singleton check)
insert into public.withdrawal_settings (id, min_amount) values (false, 100);
-- Expected: fails — id must be true (check constraint), and even 'true' again would hit the primary key

-- valid pending request succeeds
insert into public.withdrawal_requests (shop_id, amount, momo_number, momo_name)
  values ('<shop-id>', 20, '0241234567', 'Test Seller');

-- a SECOND pending request for the same shop must fail (partial unique index)
insert into public.withdrawal_requests (shop_id, amount, momo_number, momo_name)
  values ('<shop-id>', 15, '0241234567', 'Test Seller');
-- Expected: fails — duplicate key on withdrawal_requests_one_pending_per_shop

-- but a second PAID/REJECTED request for the same shop is fine (different status)
update public.withdrawal_requests set status = 'paid', processed_at = now()
  where shop_id = '<shop-id>' and status = 'pending';
insert into public.withdrawal_requests (shop_id, amount, momo_number, momo_name)
  values ('<shop-id>', 15, '0241234567', 'Test Seller');
-- Expected: succeeds — only one row was ever 'pending' at a time

-- amount must be positive
insert into public.withdrawal_requests (shop_id, amount, momo_number, momo_name)
  values ('<shop-id>', 0, '0241234567', 'Test Seller');
-- Expected: fails — check (amount > 0)

-- Clean up test rows
delete from public.withdrawal_requests where shop_id = '<shop-id>' and momo_name = 'Test Seller';
```

Expected: all marked-fail inserts fail with the stated reason; everything else succeeds.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/019_seller_withdrawals.sql
git commit -m "feat: add withdrawal settings, requests, and payout-detail columns"
```

---

### Task 2: Type system — payout fields, withdrawal types

**Files:**
- Modify: `lib/supabase/types.ts`

**Interfaces:**
- Produces: `Shop.momo_number`/`Shop.momo_name`, `WalletTransaction.withdrawal_request_id`, `WithdrawalSettings`, `WithdrawalRequest`, `WithdrawalRequestWithShop` types. Used by every later task.

- [ ] **Step 1: Add `momo_number`/`momo_name` to the existing `shops` table entry**

Find (around line 202-214):

```ts
      shops: {
        Row: {
          id: string
          owner_id: string
          name: string
          slug: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['shops']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['shops']['Insert']>
      }
```

Add `momo_number: string | null` and `momo_name: string | null` to the `Row` (e.g. right after `slug: string`):

```ts
      shops: {
        Row: {
          id: string
          owner_id: string
          name: string
          slug: string
          momo_number: string | null
          momo_name: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['shops']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['shops']['Insert']>
      }
```

- [ ] **Step 2: Add `withdrawal_request_id` to the existing `wallet_transactions` table entry**

Find (around line 227-239):

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

Add `withdrawal_request_id: string | null` (right after `order_id`):

```ts
      wallet_transactions: {
        Row: {
          id: string
          shop_id: string
          order_id: string | null
          withdrawal_request_id: string | null
          type: 'credit' | 'debit'
          amount: number
          description: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['wallet_transactions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['wallet_transactions']['Insert']>
      }
```

- [ ] **Step 3: Add two new table entries**

In the same `Tables` object, alongside `wallet_transactions`, add:

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

- [ ] **Step 4: Add convenience types**

At the bottom of the file, alongside the other `export type X = Database[...]['Row']` lines, add:

```ts
export type WithdrawalSettings = Database['public']['Tables']['withdrawal_settings']['Row']
export type WithdrawalRequest = Database['public']['Tables']['withdrawal_requests']['Row']

export interface WithdrawalRequestWithShop extends WithdrawalRequest {
  shop: Pick<Shop, 'id' | 'name' | 'slug'>
}
```

(`Shop` is already exported above this point in the file — confirm the new interface is added after that line so the reference resolves.)

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean (no other file references these new fields/types yet, so nothing should break).

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: add withdrawal types and shop payout-detail fields"
```

---

### Task 3: Ledger functions — withdrawable balance, withdrawal debit

**Files:**
- Modify: `lib/wallet-ledger.ts`

**Interfaces:**
- Produces: `computeWithdrawableBalance(shopId: string): Promise<number>`, `debitWalletForWithdrawal(withdrawalRequestId: string): Promise<void>`. Used by Task 4 (`getWithdrawableBalance`), Task 5 (`requestWithdrawal`, `markWithdrawalPaid`).

- [ ] **Step 1: Add the two functions**

Append to the end of the existing file (after `reverseShopEarnings`):

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
// as creditShopEarnings/reverseShopEarnings above.
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

No new imports needed — `createAdminClient` is already imported at the top of this file.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manually verify (deferred — no live DB in a sandboxed environment)**

If you have live Supabase access: with a shop that has a balance of 100 and a pending withdrawal request of 30, confirm `computeWithdrawableBalance(shopId)` returns 70. Mark that request `paid` directly in SQL, call `debitWalletForWithdrawal(requestId)`, confirm exactly one debit row appears with the right `withdrawal_request_id`; call it a second time and confirm no second row is inserted (idempotent).

- [ ] **Step 4: Commit**

```bash
git add lib/wallet-ledger.ts
git commit -m "feat: add computeWithdrawableBalance and debitWalletForWithdrawal"
```

---

### Task 4: Seller-facing wallet reads/writes

**Files:**
- Modify: `lib/actions/wallet.ts`

**Interfaces:**
- Consumes: `computeWithdrawableBalance` (Task 3), `WithdrawalSettings`/`WithdrawalRequest` types (Task 2).
- Produces: `getWithdrawableBalance()`, `getWithdrawalSettings()`, `updateShopPayoutDetails(formData)`, `getMyWithdrawalRequests()`. Used by Task 5 (`requestWithdrawal` reuses `computeWithdrawableBalance` directly, not this file's wrapper) and Task 7 (the wallet page).

- [ ] **Step 1: Add the four functions and update imports**

Change the import line:

```ts
import type { WalletTransaction } from '@/lib/supabase/types'
```

to:

```ts
import type { WalletTransaction, WithdrawalSettings, WithdrawalRequest } from '@/lib/supabase/types'
```

Add a new import for `computeWithdrawableBalance`:

```ts
import { computeWithdrawableBalance } from '@/lib/wallet-ledger'
```

Append these four functions to the end of the file:

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

`updateShopPayoutDetails` needs `revalidatePath` — add `import { revalidatePath } from 'next/cache'` to the top imports if not already present (it isn't in this file yet).

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run a full production build (not just tsc) — this file is `'use server'`**

Run: `npm run build`
Expected: succeeds, with `/seller/wallet` (and every other route) listed in the route summary at the end. This is the check that would have caught the export-shape bug from an earlier sub-project — `tsc --noEmit` alone does not catch it. If the build fails with "A 'use server' file can only export async functions", check that nothing non-function (like a Zod schema) was accidentally exported from this file.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: 22/22 passing, no regressions.

- [ ] **Step 5: Manually verify (deferred — no live DB in a sandboxed environment)**

If you have live access: call `updateShopPayoutDetails` with a valid/invalid MoMo number and confirm the validation messages; confirm `getWithdrawalSettings()` returns the seeded `min_amount: 50` row.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/wallet.ts
git commit -m "feat: add seller payout-details and withdrawal-history reads"
```

---

### Task 5: Withdrawal request/admin actions

**Files:**
- Create: `lib/actions/withdrawals.ts`

**Interfaces:**
- Consumes: `computeWithdrawableBalance`, `debitWalletForWithdrawal` (Task 3), `requireAdmin` (existing), `requireShopOwner` (existing), `WithdrawalRequestWithShop` type (Task 2).
- Produces: `requestWithdrawal(formData)`, `getPendingWithdrawalRequests()`, `getWithdrawalHistory()`, `markWithdrawalPaid(requestId)`, `rejectWithdrawal(requestId, reason)`, `updateMinWithdrawalAmount(minAmount)`, `adjustWalletBalance(shopSlug, type, amount, reason)`. Used by Task 7 (seller wallet page: `requestWithdrawal`) and Task 8 (admin withdrawals page: everything else).

- [ ] **Step 1: Write the file**

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

// Manual wallet adjustment — the in-app remedy for two gaps parked during the
// wallet ledger's final review: a refund processed only in the Paystack
// dashboard (never auto-reversed), and an order that was wrongly cancelled
// and un-cancelled (the ledger's own idempotency makes that un-recoverable
// automatically). Requires a mandatory reason for auditability.
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

Note: `AmountSchema` is a module-level `const`, never `export`ed — matching the safe pattern already used for `MarkupSchema` in `lib/actions/shop-products.ts`. Do not change this to `export const`.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run a full production build — this is a new `'use server'` file**

Run: `npm run build`
Expected: succeeds. Confirm no export in this file is anything other than an async function (the `AmountSchema` const must stay unexported, per Step 1's note).

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: 22/22 passing.

- [ ] **Step 5: Manually verify (deferred — no live DB in a sandboxed environment)**

If you have live access: full request → approve → debit cycle, and separately a request → reject cycle, and a double-click on "mark paid" (confirm only one debit, second click returns the "already processed" error).

- [ ] **Step 6: Commit**

```bash
git add lib/actions/withdrawals.ts
git commit -m "feat: add withdrawal request and admin processing actions"
```

---

### Task 6: Admin shop listing actions

**Files:**
- Create: `lib/actions/shops-admin.ts`

**Interfaces:**
- Produces: `getAllShops(): Promise<ShopWithStats[]>`, `toggleShopActive(shopId, active)`. Used by Task 9 (admin shops page).

- [ ] **Step 1: Write the file**

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

  // public.users has no email column (it only mirrors id/role). Email lives
  // in auth.users, which the Admin Auth API reads correctly with the
  // service-role key — a plain .from('users') query would NOT have it.
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

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean. If `admin.auth.admin.listUsers` reports a type error, check the installed `@supabase/supabase-js` version exposes `.auth.admin.listUsers` on the client returned by `createAdminClient()` — it does in this repo's version, since `createAdminClient` builds a full service-role client via `createClient` from `@supabase/supabase-js`, not a restricted client.

- [ ] **Step 3: Run a full production build — this is a new `'use server'` file**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: 22/22 passing.

- [ ] **Step 5: Manually verify (deferred — no live DB in a sandboxed environment)**

If you have live access: confirm `getAllShops()` returns every shop with a correct `product_count` and a real `owner_email` (not `null`) for at least one shop whose owner you know.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/shops-admin.ts
git commit -m "feat: add admin shop listing and active-toggle actions"
```

---

### Task 7: Seller wallet page — payout details, withdrawal request, history

**Files:**
- Modify: `app/seller/(shop)/wallet/page.tsx`
- Create: `components/seller/WithdrawalPanel.tsx`

**Interfaces:**
- Consumes: `getWithdrawableBalance`, `getWithdrawalSettings`, `updateShopPayoutDetails`, `getMyWithdrawalRequests` (Task 4), `requestWithdrawal` (Task 5), the shop's `momo_number`/`momo_name` (Task 2 — the page needs the shop row, not just wallet data, so it needs `getMyShop()` too, existing from an earlier sub-project).

- [ ] **Step 1: Create `components/seller/WithdrawalPanel.tsx`**

A client component so it can hold form/edit-mode state, given a shop's current payout details, the withdrawable balance, the minimum amount, and any pending request, passed in as props (fetched server-side by the page):

```tsx
'use client'

import { useState, useTransition } from 'react'
import { formatGHS } from '@/lib/utils'
import { updateShopPayoutDetails } from '@/lib/actions/wallet'
import { requestWithdrawal } from '@/lib/actions/withdrawals'
import type { WithdrawalRequest } from '@/lib/supabase/types'

interface Props {
  momoNumber: string | null
  momoName: string | null
  withdrawableBalance: number
  minAmount: number
  pendingRequest: WithdrawalRequest | null
}

export default function WithdrawalPanel({ momoNumber, momoName, withdrawableBalance, minAmount, pendingRequest }: Props) {
  const [editingPayout, setEditingPayout] = useState(!momoNumber || !momoName)
  const [payoutError, setPayoutError] = useState('')
  const [requestError, setRequestError] = useState('')
  const [requestSuccess, setRequestSuccess] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSavePayout(formData: FormData) {
    setPayoutError('')
    startTransition(async () => {
      const result = await updateShopPayoutDetails(formData)
      if (result?.error) {
        setPayoutError(result.error)
        return
      }
      setEditingPayout(false)
    })
  }

  function handleRequest(formData: FormData) {
    setRequestError('')
    setRequestSuccess(false)
    startTransition(async () => {
      const result = await requestWithdrawal(formData)
      if (result?.error) {
        setRequestError(result.error)
        return
      }
      setRequestSuccess(true)
    })
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8 max-w-sm space-y-5">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Available to withdraw</p>
        <p className="text-3xl font-bold text-gray-900">{formatGHS(withdrawableBalance)}</p>
        <p className="text-xs text-gray-400 mt-1">Minimum withdrawal: {formatGHS(minAmount)}</p>
      </div>

      {editingPayout ? (
        <form action={handleSavePayout} className="space-y-2">
          <label className="block text-xs font-medium text-gray-600">MoMo number</label>
          <input name="momo_number" defaultValue={momoNumber ?? ''} placeholder="0241234567" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
          <label className="block text-xs font-medium text-gray-600">Name on MoMo account</label>
          <input name="momo_name" defaultValue={momoName ?? ''} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
          {payoutError && <p className="text-xs text-red-600">{payoutError}</p>}
          <button type="submit" disabled={pending} className="text-sm font-semibold text-green-600 disabled:text-gray-300">
            Save payout details
          </button>
        </form>
      ) : (
        <div className="text-sm text-gray-600">
          <p>{momoName} — {momoNumber}</p>
          <button onClick={() => setEditingPayout(true)} className="text-xs text-green-600 hover:underline mt-1">
            Edit
          </button>
        </div>
      )}

      {!editingPayout && (
        pendingRequest ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            Withdrawal of {formatGHS(pendingRequest.amount)} pending since{' '}
            {new Date(pendingRequest.requested_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.
          </p>
        ) : (
          <form action={handleRequest} className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">Amount to withdraw</label>
            <input name="amount" type="number" min={minAmount} step="0.01" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
            {requestError && <p className="text-xs text-red-600">{requestError}</p>}
            {requestSuccess && <p className="text-xs text-green-600">Withdrawal requested.</p>}
            <button
              type="submit"
              disabled={pending || withdrawableBalance < minAmount}
              className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              Request Withdrawal
            </button>
          </form>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 2: Modify `app/seller/(shop)/wallet/page.tsx`**

Replace the full file with:

```tsx
export const dynamic = 'force-dynamic'
import { getWalletBalance, getWalletTransactions, getWithdrawableBalance, getWithdrawalSettings, getMyWithdrawalRequests } from '@/lib/actions/wallet'
import { getMyShop } from '@/lib/actions/shops'
import { formatGHS } from '@/lib/utils'
import WithdrawalPanel from '@/components/seller/WithdrawalPanel'

export default async function SellerWalletPage() {
  const [balance, transactions, withdrawableBalance, settings, myRequests, shop] = await Promise.all([
    getWalletBalance(),
    getWalletTransactions(),
    getWithdrawableBalance(),
    getWithdrawalSettings(),
    getMyWithdrawalRequests(),
    getMyShop(),
  ])

  const pendingRequest = myRequests.find((r) => r.status === 'pending') ?? null

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Wallet</h1>

      <div className="flex flex-wrap gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 max-w-xs">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total balance</p>
          <p className="text-3xl font-bold text-gray-900">{formatGHS(balance)}</p>
        </div>

        <WithdrawalPanel
          momoNumber={shop?.momo_number ?? null}
          momoName={shop?.momo_name ?? null}
          withdrawableBalance={withdrawableBalance}
          minAmount={settings.min_amount}
          pendingRequest={pendingRequest}
        />
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Transaction history</h2>

      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No transactions yet.</p>
      ) : (
        <table className="w-full text-sm mb-10">
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

      {myRequests.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Withdrawal history</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 text-gray-500">
                    {new Date(r.requested_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-3 pr-4 text-gray-800">{formatGHS(r.amount)}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.status === 'paid' ? 'bg-green-50 text-green-700' : r.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 text-gray-500">{r.admin_note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Run a full production build**

Run: `npm run build`
Expected: succeeds, `/seller/wallet` still listed in the route summary.

- [ ] **Step 5: Run the full test suite and lint**

Run: `npx vitest run && npx eslint "app/seller/(shop)/wallet/page.tsx" components/seller/WithdrawalPanel.tsx`
Expected: 22/22 passing, no new lint errors.

- [ ] **Step 6: Manually verify (deferred — no live DB in a sandboxed environment)**

If you have live access: visit `/seller/wallet` as a seller with no payout details set (form should show and block the withdrawal request), save details, then request a withdrawal within/above/below the min and available balance and confirm each case's message.

- [ ] **Step 7: Commit**

```bash
git add "app/seller/(shop)/wallet/page.tsx" components/seller/WithdrawalPanel.tsx
git commit -m "feat: add payout details and withdrawal request UI to seller wallet page"
```

---

### Task 8: Admin withdrawals page

**Files:**
- Create: `app/admin/withdrawals/page.tsx`
- Create: `components/admin/WithdrawalActions.tsx`
- Create: `components/admin/ManualAdjustmentForm.tsx`

**Interfaces:**
- Consumes: `getPendingWithdrawalRequests`, `getWithdrawalHistory`, `markWithdrawalPaid`, `rejectWithdrawal`, `updateMinWithdrawalAmount`, `adjustWalletBalance` (Task 5), `getWithdrawalSettings` (Task 4).

- [ ] **Step 1: Create `components/admin/WithdrawalActions.tsx`**

Client component for the per-row Mark Paid / Reject buttons (needs local state for the reject-reason prompt):

```tsx
'use client'

import { useState, useTransition } from 'react'
import { markWithdrawalPaid, rejectWithdrawal } from '@/lib/actions/withdrawals'

export default function WithdrawalActions({ requestId }: { requestId: string }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function handleMarkPaid() {
    setError('')
    startTransition(async () => {
      const result = await markWithdrawalPaid(requestId)
      if (result?.error) setError(result.error)
    })
  }

  function handleReject() {
    setError('')
    startTransition(async () => {
      const result = await rejectWithdrawal(requestId, reason)
      if (result?.error) setError(result.error)
      else setRejecting(false)
    })
  }

  if (rejecting) {
    return (
      <div className="flex items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
          className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-32"
        />
        <button onClick={handleReject} disabled={pending} className="text-xs font-semibold text-red-600">Confirm</button>
        <button onClick={() => setRejecting(false)} className="text-xs text-gray-400">Cancel</button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleMarkPaid} disabled={pending} className="text-xs font-semibold text-green-600 hover:underline">
        Mark Paid
      </button>
      <button onClick={() => setRejecting(true)} disabled={pending} className="text-xs font-semibold text-red-500 hover:underline">
        Reject
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/admin/ManualAdjustmentForm.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { adjustWalletBalance } from '@/lib/actions/withdrawals'

export default function ManualAdjustmentForm() {
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setMessage('')
    startTransition(async () => {
      const result = await adjustWalletBalance(
        String(formData.get('shop_slug')),
        formData.get('type') as 'credit' | 'debit',
        Number(formData.get('amount')),
        String(formData.get('reason'))
      )
      if (result?.error) setMessage(result.error)
      else setMessage('Adjustment applied.')
    })
  }

  return (
    <form action={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 max-w-md space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Manual Wallet Adjustment</h3>
      <input name="shop_slug" placeholder="Shop URL slug" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      <div className="flex gap-3">
        <select name="type" className="border border-gray-300 rounded-xl px-3 py-2 text-sm">
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
        <input name="amount" type="number" step="0.01" placeholder="Amount" className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      </div>
      <input name="reason" placeholder="Reason (required)" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      {message && <p className="text-xs text-gray-600">{message}</p>}
      <button type="submit" disabled={pending} className="text-sm font-semibold text-green-600 disabled:text-gray-300">
        Apply Adjustment
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Create `app/admin/withdrawals/page.tsx`**

```tsx
export const dynamic = 'force-dynamic'
import { getPendingWithdrawalRequests, getWithdrawalHistory } from '@/lib/actions/withdrawals'
import { getWithdrawalSettings } from '@/lib/actions/wallet'
import { formatGHS } from '@/lib/utils'
import WithdrawalActions from '@/components/admin/WithdrawalActions'
import ManualAdjustmentForm from '@/components/admin/ManualAdjustmentForm'

export default async function AdminWithdrawalsPage() {
  const [pending, history, settings] = await Promise.all([
    getPendingWithdrawalRequests(),
    getWithdrawalHistory(),
    getWithdrawalSettings(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Withdrawals</h1>
        <p className="text-sm text-gray-400">Minimum withdrawal: {formatGHS(settings.min_amount)}</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400">No pending requests.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
                <th className="py-2 pr-4">Shop</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">MoMo</th>
                <th className="py-2 pr-4">Requested</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 font-medium text-gray-800">{r.shop.name}</td>
                  <td className="py-3 pr-4">{formatGHS(r.amount)}</td>
                  <td className="py-3 pr-4 text-gray-500">{r.momo_name} — {r.momo_number}</td>
                  <td className="py-3 pr-4 text-gray-500">
                    {new Date(r.requested_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-3"><WithdrawalActions requestId={r.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ManualAdjustmentForm />

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">No processed requests yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
                <th className="py-2 pr-4">Shop</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Processed</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 font-medium text-gray-800">{r.shop.name}</td>
                  <td className="py-3 pr-4">{formatGHS(r.amount)}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-500">
                    {r.processed_at ? new Date(r.processed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="py-3 text-gray-500">{r.admin_note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Run a full production build**

Run: `npm run build`
Expected: succeeds, `/admin/withdrawals` listed in the route summary.

- [ ] **Step 6: Run the full test suite and lint**

Run: `npx vitest run && npx eslint app/admin/withdrawals/page.tsx components/admin/WithdrawalActions.tsx components/admin/ManualAdjustmentForm.tsx`
Expected: 22/22 passing, no new lint errors.

- [ ] **Step 7: Manually verify (deferred — no live DB in a sandboxed environment)**

If you have live access: click Mark Paid on a real pending request, confirm it moves to History and a debit appears in that shop's wallet; click Reject with a reason and confirm the same for the rejection path; use the manual adjustment form on a real shop slug and confirm the transaction appears with the "Manual adjustment: <reason>" description.

- [ ] **Step 8: Commit**

```bash
git add app/admin/withdrawals/page.tsx components/admin/WithdrawalActions.tsx components/admin/ManualAdjustmentForm.tsx
git commit -m "feat: add admin withdrawals page"
```

---

### Task 9: Admin shops page + sidebar nav

**Files:**
- Create: `app/admin/shops/page.tsx`
- Create: `components/admin/ShopActiveToggle.tsx`
- Modify: `components/admin/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `getAllShops`, `toggleShopActive` (Task 6).

- [ ] **Step 1: Create `components/admin/ShopActiveToggle.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { toggleShopActive } from '@/lib/actions/shops-admin'

export default function ShopActiveToggle({ shopId, active }: { shopId: string; active: boolean }) {
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      await toggleShopActive(shopId, !active)
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
        active ? 'bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-700' : 'bg-red-50 text-red-700 hover:bg-green-50 hover:text-green-700'
      }`}
    >
      {active ? 'Active' : 'Suspended'}
    </button>
  )
}
```

- [ ] **Step 2: Create `app/admin/shops/page.tsx`**

```tsx
export const dynamic = 'force-dynamic'
import { getAllShops } from '@/lib/actions/shops-admin'
import ShopActiveToggle from '@/components/admin/ShopActiveToggle'
import Link from 'next/link'

export default async function AdminShopsPage() {
  const shops = await getAllShops()

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Shops ({shops.length})</h1>

      {shops.length === 0 ? (
        <p className="text-sm text-gray-400">No shops yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
              <th className="py-2 pr-4">Shop</th>
              <th className="py-2 pr-4">Owner</th>
              <th className="py-2 pr-4">Products</th>
              <th className="py-2 pr-4">Created</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-3 pr-4">
                  <Link href={`/shop/${s.slug}`} target="_blank" className="font-medium text-gray-800 hover:text-green-600">
                    {s.name}
                  </Link>
                  <p className="text-xs text-gray-400">/shop/{s.slug}</p>
                </td>
                <td className="py-3 pr-4 text-gray-500">{s.owner_email ?? '—'}</td>
                <td className="py-3 pr-4 text-gray-500">{s.product_count}</td>
                <td className="py-3 pr-4 text-gray-500">
                  {new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="py-3"><ShopActiveToggle shopId={s.id} active={s.active} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Modify `components/admin/AdminSidebar.tsx`**

Change the icon import line:

```ts
import { LayoutDashboard, Package, ShoppingBag, Tag, Users, Truck, Megaphone, Ticket, LogOut, ExternalLink, Zap, Building2, TrendingUp, Palette, Menu, X } from 'lucide-react'
```

to:

```ts
import { LayoutDashboard, Package, ShoppingBag, Tag, Users, Truck, Megaphone, Ticket, LogOut, ExternalLink, Zap, Building2, TrendingUp, Palette, Menu, X, Store, Banknote } from 'lucide-react'
```

Change the `NAV` array from:

```ts
const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/categories', label: 'Categories', icon: Tag },
  { href: '/admin/delivery', label: 'Delivery Fees', icon: Truck },
  { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { href: '/admin/banner', label: 'Banner', icon: Megaphone },
  { href: '/admin/flash-sales', label: 'Flash Sales', icon: Zap },
  { href: '/admin/brands', label: 'Brands', icon: Building2 },
  { href: '/admin/product-options', label: 'Product Options', icon: Palette },
  { href: '/admin/trending-searches', label: 'Trending', icon: TrendingUp },
]
```

to (adding `Shops` after `Users`, and `Withdrawals` after `Trending`):

```ts
const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/shops', label: 'Shops', icon: Store },
  { href: '/admin/categories', label: 'Categories', icon: Tag },
  { href: '/admin/delivery', label: 'Delivery Fees', icon: Truck },
  { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { href: '/admin/banner', label: 'Banner', icon: Megaphone },
  { href: '/admin/flash-sales', label: 'Flash Sales', icon: Zap },
  { href: '/admin/brands', label: 'Brands', icon: Building2 },
  { href: '/admin/product-options', label: 'Product Options', icon: Palette },
  { href: '/admin/trending-searches', label: 'Trending', icon: TrendingUp },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: Banknote },
]
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Run a full production build**

Run: `npm run build`
Expected: succeeds, `/admin/shops` listed in the route summary.

- [ ] **Step 6: Run the full test suite and lint**

Run: `npx vitest run && npx eslint app/admin/shops/page.tsx components/admin/ShopActiveToggle.tsx components/admin/AdminSidebar.tsx`
Expected: 22/22 passing, no new lint errors.

- [ ] **Step 7: Manually verify (deferred — no live DB in a sandboxed environment)**

If you have live access: visit `/admin/shops`, confirm every shop appears with a correct product count and owner email, toggle one shop's status and confirm its public `/shop/[slug]` storefront now 404s (or comes back) accordingly.

- [ ] **Step 8: Commit**

```bash
git add app/admin/shops/page.tsx components/admin/ShopActiveToggle.tsx components/admin/AdminSidebar.tsx
git commit -m "feat: add admin shops listing page with active/suspend toggle"
```

---

### Task 10: Final end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full happy-path walkthrough** (requires live Supabase with migrations 016-019 applied, and a shop with a real balance)

1. As a seller, visit `/seller/wallet`, save MoMo details, request a withdrawal within the min/available range.
2. As an admin, visit `/admin/withdrawals`, see the pending request, click Mark Paid.
3. Confirm a debit transaction appears in the seller's wallet transaction history, the balance drops, and the request moves to History as "paid".
4. Repeat with a Reject instead — confirm no debit, the request shows "rejected" with the reason, and the seller can submit a new request immediately (no more "already have a pending request" error).

- [ ] **Step 2: Manual adjustment + admin shops page**

1. On `/admin/withdrawals`, use the Manual Adjustment form with a real shop slug — confirm the transaction appears in that shop's `/seller/wallet` history with the "Manual adjustment: <reason>" description.
2. On `/admin/shops`, confirm every shop appears with correct stats, and toggling a shop's active status actually changes whether its public storefront 404s.

- [ ] **Step 3: Regression check**

1. Re-confirm the sub-project 1 and sub-project 3 happy paths (shop creation, curation, storefront purchase, order-driven wallet credit/reversal) still work unmodified.
2. Confirm a shop with `withdrawableBalance < minAmount` sees the Request Withdrawal button disabled rather than a confusing failed submission.

- [ ] **Step 4: No commit expected** unless verification surfaces a bug, in which case fix it, verify, and commit normally.
