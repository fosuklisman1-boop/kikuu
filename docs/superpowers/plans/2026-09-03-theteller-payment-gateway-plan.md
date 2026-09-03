# TheTeller Payment Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TheTeller as a second payment gateway alongside Paystack, admin-toggleable, with a shared verification path for both and a scheduled reconciliation job covering TheTeller's lack of a real webhook.

**Architecture:** A thin `lib/theteller.ts` API wrapper mirrors the existing `lib/paystack.ts`. A new `payment_gateway_settings` singleton table (same pattern as the existing `withdrawal_settings`) controls which gateway(s) checkout offers. `orders.payment_type` (already `'paystack' | 'cod'`) gains a `'theteller'` value. The existing `processVerification` function in the payment-verify route is generalized to branch on gateway rather than duplicated. A Vercel Cron job polls stuck-pending TheTeller orders through the same shared verification path.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), Zod, Vitest, Vercel Cron — unchanged plus one new scheduled-job mechanism.

**Spec:** [docs/superpowers/specs/2026-09-03-theteller-payment-gateway-design.md](../specs/2026-09-03-theteller-payment-gateway-design.md)

## Global Constraints

- Every server action derives admin scope via `requireAdmin()` — never accept a client-supplied admin claim.
- Never trust a client-sent `payment_type` at checkout without cross-checking `payment_gateway_settings` server-side first.
- The reconciliation cron route is the one endpoint in this plan not gated by a Supabase session — it must reject any request without the correct `Authorization: Bearer $CRON_SECRET` header before touching the database.
- This is money-movement code: every task touching `app/api/checkout/route.ts`, `app/api/payment/verify/route.ts`, the new `theteller-verify` route, or the reconciliation cron requires a real `npm run build` (not just `tsc --noEmit`) and careful hand-traced scenario verification, per this project's standing rule that a real production incident was once invisible to `tsc`/Vitest alike.
- `processVerification`'s existing atomic `.eq('status', 'pending')` idempotency guard must keep protecting both gateways identically — a TheTeller order verified twice (once via redirect, once via a racing reconciliation-cron run) must never double-process.
- No new database migration beyond the one specified in Task 2 — do not add unrelated schema changes.
- Real credentials (`THETELLER_MERCHANT_ID`, `THETELLER_API_USER`, `THETELLER_API_KEY`, `THETELLER_LIVE`, `CRON_SECRET`) are set by the user directly in `.env.local`/Vercel, never pasted into any file, commit, or task report.

---

### Task 1: `lib/theteller.ts` — TheTeller API wrapper

**Files:**
- Create: `lib/theteller.ts`
- Create: `lib/theteller.test.ts`

**Interfaces:**
- Produces: `initiatePayment(params: InitiatePaymentParams): Promise<InitiateResult>`, `checkTransactionStatus(transactionId: string): Promise<TransactionStatusResult>`, `generateTransactionId(): string`. Used by Task 4 (checkout route) and Task 5 (verification refactor, reconciliation cron).

- [ ] **Step 1: Write the failing test for `generateTransactionId`**

This is the only pure, unit-testable piece in this file — `initiatePayment`/`checkTransactionStatus` are thin fetch wrappers with no branching logic of their own, matching how `lib/paystack.ts`'s equivalent functions are not unit tested in this codebase (its external HTTP calls aren't mocked anywhere).

```ts
// lib/theteller.test.ts
import { describe, it, expect } from 'vitest'
import { generateTransactionId } from './theteller'

describe('generateTransactionId', () => {
  it('produces exactly 12 digits', () => {
    const id = generateTransactionId()
    expect(id).toMatch(/^\d{12}$/)
  })

  it('produces different values across calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateTransactionId()))
    expect(ids.size).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/theteller.test.ts`
Expected: FAIL — `Cannot find module './theteller'`.

- [ ] **Step 3: Write the full implementation**

```ts
// lib/theteller.ts

const THETELLER_BASE = process.env.THETELLER_LIVE === 'true'
  ? 'https://checkout.theteller.net'
  : 'https://checkout-test.theteller.net'

const MERCHANT_ID = process.env.THETELLER_MERCHANT_ID!
const API_USER = process.env.THETELLER_API_USER!
const API_KEY = process.env.THETELLER_API_KEY!

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${API_USER}:${API_KEY}`).toString('base64')
}

export interface InitiatePaymentParams {
  email: string
  amount: number // in GHS
  transactionId: string // exactly 12 digits
  desc: string
  redirectUrl: string
}

export interface InitiateResult {
  checkoutUrl: string
  token: string
}

// Initiate a TheTeller Standard Checkout payment. Throws on any non-success
// response, matching lib/paystack.ts's initializePayment convention.
export async function initiatePayment(params: InitiatePaymentParams): Promise<InitiateResult> {
  const res = await fetch(`${THETELLER_BASE}/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify({
      merchant_id: MERCHANT_ID,
      transaction_id: params.transactionId,
      desc: params.desc,
      amount: params.amount.toFixed(2),
      redirect_url: params.redirectUrl,
      email: params.email,
      API_Key: API_KEY,
      apiuser: API_USER,
    }),
  })
  const json = await res.json()
  if (json.status !== 'success') throw new Error(json.reason || 'TheTeller initiate failed')
  return { checkoutUrl: json.checkout_url, token: json.token }
}

export interface TransactionStatusResult {
  status: string // 'approved' on success
  code: string // '000' on success
  transactionId: string
  amount: number // in GHS
}

// Poll TheTeller's transaction status endpoint. Used both by the redirect
// verification route and the reconciliation cron.
export async function checkTransactionStatus(transactionId: string): Promise<TransactionStatusResult> {
  const res = await fetch(
    `${THETELLER_BASE}/v1.1/users/transactions/${encodeURIComponent(transactionId)}/status`,
    {
      headers: {
        'Content-Type': 'application/json',
        'Merchant-Id': MERCHANT_ID,
        'Cache-Control': 'no-cache',
      },
    }
  )
  const json = await res.json()
  return {
    status: json.status,
    code: json.code,
    transactionId: json.transaction_id,
    amount: Number(json.amount),
  }
}

// TheTeller requires exactly 12 digits. Timestamp (13 digits) + 3 random
// digits, taking the last 12 — sufficiently unique for practical purposes.
// This column has no DB-level unique constraint (matching how
// paystack_reference isn't uniquely constrained either); a rare collision
// would surface as a verify-time reference mismatch, not silent corruption.
export function generateTransactionId(): string {
  const timestamp = Date.now().toString()
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return (timestamp + random).slice(-12)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/theteller.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean. (The `THETELLER_MERCHANT_ID!`/`API_USER!`/`API_KEY!` non-null assertions match the exact convention already used for `PAYSTACK_SECRET_KEY!` in `lib/paystack.ts` — real values aren't required for this to type-check or for the file to load in a build; they're only read when `initiatePayment`/`checkTransactionStatus` are actually called at runtime.)

- [ ] **Step 6: Commit**

```bash
git add lib/theteller.ts lib/theteller.test.ts
git commit -m "feat: add TheTeller payment gateway API wrapper"
```

---

### Task 2: Database migration — `payment_type` extension, `theteller_transaction_id`, `payment_gateway_settings`

**Files:**
- Create: `supabase/migrations/020_theteller_payment_gateway.sql`

**Interfaces:**
- Produces: `orders.payment_type` now allows `'theteller'`; `orders.theteller_transaction_id` (nullable text); `payment_gateway_settings` table (singleton, columns `id boolean primary key default true`, `paystack_enabled boolean`, `theteller_enabled boolean`, `updated_at timestamptz`). Used by Task 3 (settings actions), Task 4 (checkout), Task 5 (verification).

This task creates the migration FILE only — applying it to the live production Supabase project is a controller-level action taken after this branch is reviewed, using the same Supabase Management API process already used for every prior migration this session (016 through 019). Do not attempt to apply this migration to any live database as part of this task.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/020_theteller_payment_gateway.sql

-- Extend the existing payment_type check (originally added in migration 008)
-- to allow 'theteller' alongside the existing 'paystack' and 'cod' values.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_type_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_type_check
  CHECK (payment_type IN ('paystack', 'cod', 'theteller'));

-- TheTeller's own transaction ID (12 digits, generated by us), set at
-- checkout time and matched against on verification — the direct equivalent
-- of the existing paystack_reference column, kept separate since the two
-- providers use different reference formats and different lookup call sites.
ALTER TABLE public.orders ADD COLUMN theteller_transaction_id text;

-- ============================================================
-- PAYMENT GATEWAY SETTINGS (admin-controlled, singleton)
-- ============================================================
CREATE TABLE public.payment_gateway_settings (
  id                boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  paystack_enabled  boolean NOT NULL DEFAULT true,
  theteller_enabled boolean NOT NULL DEFAULT false,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.payment_gateway_settings (id) VALUES (true);

ALTER TABLE public.payment_gateway_settings ENABLE ROW LEVEL SECURITY;
-- No public read/write policy — this table is only ever read or written
-- through the admin-client server actions in lib/actions/payment-settings.ts,
-- matching the existing withdrawal_settings table's access pattern exactly
-- (see supabase/migrations/019_seller_withdrawals.sql for that precedent).
```

- [ ] **Step 2: Verify the file is syntactically well-formed**

Read the migration file back and manually trace each statement against the spec's exact SQL — there is no local Postgres instance in this environment to execute a dry run against, so careful manual verification substitutes: confirm every `ALTER TABLE`/`CREATE TABLE` statement is a complete, valid Postgres statement, confirm the `orders_payment_type_check` constraint name matches the auto-generated name Postgres assigns to the original inline `CHECK` added in migration 008's `ADD COLUMN ... CHECK (...)` syntax (the `{table}_{column}_check` default naming convention), and confirm the `payment_gateway_settings` table's shape is structurally identical to `withdrawal_settings` in migration 019 (read that file for direct comparison).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/020_theteller_payment_gateway.sql
git commit -m "feat: add migration for TheTeller payment gateway support"
```

---

### Task 3: Payment gateway settings — actions and admin UI

**Files:**
- Create: `lib/actions/payment-settings.ts`
- Create: `app/admin/payments/page.tsx`
- Create: `components/admin/PaymentGatewayForm.tsx`

**Interfaces:**
- Consumes: `payment_gateway_settings` table (Task 2).
- Produces: `getPaymentGatewaySettings(): Promise<{ paystackEnabled: boolean; tellerEnabled: boolean }>`, `updatePaymentGatewaySettings(formData: FormData): Promise<{ error?: string }>`. Used by Task 4 (checkout route and form both read `getPaymentGatewaySettings`).

- [ ] **Step 1: Read the existing withdrawal-settings pattern for reference**

Read `lib/actions/wallet.ts`'s `getWithdrawalSettings` function and `components/admin/MinAmountForm.tsx` in full — this task's action and form follow the identical shape (a singleton settings row, a small form posting to a server action, `revalidatePath` on success).

- [ ] **Step 2: Write `lib/actions/payment-settings.ts`**

```ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'

export async function getPaymentGatewaySettings(): Promise<{ paystackEnabled: boolean; tellerEnabled: boolean }> {
  const admin = createAdminClient()
  const { data } = await admin.from('payment_gateway_settings').select('*').eq('id', true).single()
  return {
    paystackEnabled: data?.paystack_enabled ?? true,
    tellerEnabled: data?.theteller_enabled ?? false,
  }
}

export async function updatePaymentGatewaySettings(formData: FormData): Promise<{ error?: string }> {
  await requireAdmin()
  const paystackEnabled = formData.get('paystack_enabled') === 'on'
  const tellerEnabled = formData.get('theteller_enabled') === 'on'
  if (!paystackEnabled && !tellerEnabled) {
    return { error: 'At least one payment gateway must stay enabled.' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('payment_gateway_settings')
    .update({ paystack_enabled: paystackEnabled, theteller_enabled: tellerEnabled })
    .eq('id', true)
  if (error) return { error: error.message }
  revalidatePath('/admin/payments')
  revalidatePath('/checkout')
  return {}
}
```

- [ ] **Step 3: Write `components/admin/PaymentGatewayForm.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { updatePaymentGatewaySettings } from '@/lib/actions/payment-settings'

export default function PaymentGatewayForm({
  initialPaystackEnabled,
  initialTellerEnabled,
}: {
  initialPaystackEnabled: boolean
  initialTellerEnabled: boolean
}) {
  const [paystackEnabled, setPaystackEnabled] = useState(initialPaystackEnabled)
  const [tellerEnabled, setTellerEnabled] = useState(initialTellerEnabled)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  function handleSubmit(formData: FormData) {
    setMessage('')
    startTransition(async () => {
      const result = await updatePaymentGatewaySettings(formData)
      setMessage(result.error ?? 'Saved.')
    })
  }

  return (
    <form action={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 max-w-md space-y-4">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="paystack_enabled"
          checked={paystackEnabled}
          onChange={(e) => setPaystackEnabled(e.target.checked)}
          className="w-4 h-4"
        />
        <span className="text-sm font-medium text-gray-700">Paystack (Card, Bank, MoMo)</span>
      </label>
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="theteller_enabled"
          checked={tellerEnabled}
          onChange={(e) => setTellerEnabled(e.target.checked)}
          className="w-4 h-4"
        />
        <span className="text-sm font-medium text-gray-700">TheTeller (Mobile Money)</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </form>
  )
}
```

- [ ] **Step 4: Write `app/admin/payments/page.tsx`**

```tsx
import { getPaymentGatewaySettings } from '@/lib/actions/payment-settings'
import PaymentGatewayForm from '@/components/admin/PaymentGatewayForm'

export default async function AdminPaymentsPage() {
  const { paystackEnabled, tellerEnabled } = await getPaymentGatewaySettings()

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Payment Gateways</h1>
      <p className="text-sm text-gray-400 mb-6">Choose which payment methods shoppers can use at checkout. At least one must stay enabled.</p>
      <PaymentGatewayForm initialPaystackEnabled={paystackEnabled} initialTellerEnabled={tellerEnabled} />
    </div>
  )
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Run a real production build**

Run: `npm run build`
Expected: succeeds. `lib/actions/payment-settings.ts` is a `'use server'` file — confirm both exports are `async function`s and nothing else is exported from it.

- [ ] **Step 7: Run eslint**

Run: `npx eslint lib/actions/payment-settings.ts app/admin/payments/page.tsx components/admin/PaymentGatewayForm.tsx`
Expected: no errors.

- [ ] **Step 8: Manual verification**

With `npm run dev` (note: this task's UI can be exercised even without the migration from Task 2 having been applied to a live database yet, AS LONG AS Task 2's migration has already been applied by the time this task runs in sequence — if it hasn't, `getPaymentGatewaySettings` will return the safe fallback `{ paystackEnabled: true, tellerEnabled: false }` since `data` will be null, and saving will fail with a database error naming the missing table; if you hit that, stop and report BLOCKED rather than guessing further), log in as an admin, visit `/admin/payments`, toggle TheTeller on, save, confirm the checkbox state persists across a page reload. Confirm attempting to uncheck both boxes and save shows the "at least one" error and doesn't save.

- [ ] **Step 9: Commit**

```bash
git add lib/actions/payment-settings.ts app/admin/payments/page.tsx components/admin/PaymentGatewayForm.tsx
git commit -m "feat: add admin payment gateway settings page"
```

---

### Task 4: Checkout flow — gateway selection and TheTeller initiation

This task touches the checkout API route, which creates real orders and initiates real payments — treat it with the same care this codebase applies to every other checkout-adjacent change.

**Files:**
- Modify: `app/api/checkout/route.ts`
- Modify: `components/store/CheckoutForm.tsx`

**Interfaces:**
- Consumes: `initiatePayment`, `generateTransactionId` (Task 1); `getPaymentGatewaySettings` (Task 3); `orders.payment_type`/`theteller_transaction_id` (Task 2).

- [ ] **Step 1: Read both current files in full**

Read `app/api/checkout/route.ts` and `components/store/CheckoutForm.tsx` in full before editing.

- [ ] **Step 2: Modify `app/api/checkout/route.ts`**

Add the import:

```ts
import { initiatePayment, generateTransactionId } from '@/lib/theteller'
import { getPaymentGatewaySettings } from '@/lib/actions/payment-settings'
```

Change the `CheckoutSchema`'s `payment_type` field from:

```ts
payment_type: z.literal('paystack').default('paystack'),
```

to:

```ts
payment_type: z.enum(['paystack', 'theteller']).default('paystack'),
```

After parsing the request body (right after `const { email, address, items: rawItems, coupon_code, shop_id } = parsed.data`), destructure `payment_type` too and validate it against the current settings:

```ts
const { email, address, items: rawItems, coupon_code, shop_id, payment_type } = parsed.data

const gatewaySettings = await getPaymentGatewaySettings()
if (payment_type === 'theteller' && !gatewaySettings.tellerEnabled) {
  return NextResponse.json({ error: 'This payment method is currently unavailable.' }, { status: 400 })
}
if (payment_type === 'paystack' && !gatewaySettings.paystackEnabled) {
  return NextResponse.json({ error: 'This payment method is currently unavailable.' }, { status: 400 })
}
```

In the order insert, change the hardcoded `payment_type: 'paystack',` to `payment_type,` (using the validated variable instead of a literal), and update the comment above it from `// Create order in DB — all orders go through Paystack, always start as pending` to `// Create order in DB — always starts pending regardless of gateway`.

Replace the existing Paystack-only initiation block:

```ts
    // Initialize Paystack payment
    const reference = generateReference(order.id)
    let payment
    try {
      payment = await initializePayment({
        email,
        amount: total,
        reference,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/verify?order_id=${order.id}`,
        metadata: { order_id: order.id, order_number: order.order_number },
      })
    } catch (paystackErr: any) {
      console.error('Paystack init error:', paystackErr)
      // Cancel the order so it doesn't sit as a ghost pending order
      await admin.from('orders').delete().eq('id', order.id)
      return NextResponse.json(
        { error: paystackErr?.message ?? 'Payment provider error. Please try again.' },
        { status: 502 }
      )
    }

    const { error: refError } = await admin
      .from('orders')
      .update({ paystack_reference: reference })
      .eq('id', order.id)

    if (refError) {
      console.error('Failed to save paystack_reference:', refError)
      await admin.from('orders').delete().eq('id', order.id)
      return NextResponse.json({ error: 'Failed to save payment reference. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({
      order_id: order.id,
      order_number: order.order_number,
      access_code: payment.access_code,
      reference,
      total,
    })
```

with a gateway-branching version:

```ts
    if (payment_type === 'theteller') {
      const transactionId = generateTransactionId()
      let tellerPayment
      try {
        tellerPayment = await initiatePayment({
          email,
          amount: total,
          transactionId,
          desc: `Order ${order.order_number}`,
          redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/theteller-verify?order_id=${order.id}`,
        })
      } catch (tellerErr: any) {
        console.error('TheTeller init error:', tellerErr)
        await admin.from('orders').delete().eq('id', order.id)
        return NextResponse.json(
          { error: tellerErr?.message ?? 'Payment provider error. Please try again.' },
          { status: 502 }
        )
      }

      const { error: tellerRefError } = await admin
        .from('orders')
        .update({ theteller_transaction_id: transactionId })
        .eq('id', order.id)

      if (tellerRefError) {
        console.error('Failed to save theteller_transaction_id:', tellerRefError)
        await admin.from('orders').delete().eq('id', order.id)
        return NextResponse.json({ error: 'Failed to save payment reference. Please try again.' }, { status: 500 })
      }

      return NextResponse.json({
        order_id: order.id,
        order_number: order.order_number,
        checkout_url: tellerPayment.checkoutUrl,
        total,
      })
    }

    // Initialize Paystack payment
    const reference = generateReference(order.id)
    let payment
    try {
      payment = await initializePayment({
        email,
        amount: total,
        reference,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/verify?order_id=${order.id}`,
        metadata: { order_id: order.id, order_number: order.order_number },
      })
    } catch (paystackErr: any) {
      console.error('Paystack init error:', paystackErr)
      // Cancel the order so it doesn't sit as a ghost pending order
      await admin.from('orders').delete().eq('id', order.id)
      return NextResponse.json(
        { error: paystackErr?.message ?? 'Payment provider error. Please try again.' },
        { status: 502 }
      )
    }

    const { error: refError } = await admin
      .from('orders')
      .update({ paystack_reference: reference })
      .eq('id', order.id)

    if (refError) {
      console.error('Failed to save paystack_reference:', refError)
      await admin.from('orders').delete().eq('id', order.id)
      return NextResponse.json({ error: 'Failed to save payment reference. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({
      order_id: order.id,
      order_number: order.order_number,
      access_code: payment.access_code,
      reference,
      total,
    })
```

- [ ] **Step 3: Modify `components/store/CheckoutForm.tsx`**

Read the current file's structure around where it currently submits the checkout request and handles the Paystack response (the `PaystackPop` block, roughly lines 200-215 per the current file). Add state for the gateway settings and selected payment type near the component's other `useState` declarations:

```ts
const [paystackEnabled, setPaystackEnabled] = useState(true)
const [tellerEnabled, setTellerEnabled] = useState(false)
const [paymentType, setPaymentType] = useState<'paystack' | 'theteller'>('paystack')
```

Add the import:

```ts
import { getPaymentGatewaySettings } from '@/lib/actions/payment-settings'
```

Add an effect to fetch settings on mount and default `paymentType` sensibly (call it alongside any other existing mount-time effects in the file, don't create a redundant second effect block if one already fetches similar startup data):

```ts
useEffect(() => {
  getPaymentGatewaySettings().then(({ paystackEnabled, tellerEnabled }) => {
    setPaystackEnabled(paystackEnabled)
    setTellerEnabled(tellerEnabled)
    if (!paystackEnabled && tellerEnabled) setPaymentType('theteller')
  })
}, [])
```

In the JSX, before the payment submit button, add a gateway selector that only renders when both are enabled:

```tsx
{paystackEnabled && tellerEnabled && (
  <div className="mb-4 space-y-2">
    <label className="flex items-center gap-2 text-sm">
      <input
        type="radio"
        name="payment_type"
        checked={paymentType === 'paystack'}
        onChange={() => setPaymentType('paystack')}
      />
      Pay with Card / Bank Transfer
    </label>
    <label className="flex items-center gap-2 text-sm">
      <input
        type="radio"
        name="payment_type"
        checked={paymentType === 'theteller'}
        onChange={() => setPaymentType('theteller')}
      />
      Pay with Mobile Money
    </label>
  </div>
)}
```

Find where the checkout request body is built (the `fetch('/api/checkout', ...)` call) and add `payment_type: paymentType` to the JSON body sent.

Find the existing Paystack-response handling block (`new PaystackPop().newTransaction({...})`) and wrap it in a branch, adding the TheTeller redirect case:

```ts
if (paymentType === 'theteller') {
  window.location.href = data.checkout_url
  return
}

// existing PaystackPop block, unchanged, goes here
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Run a real production build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Run eslint**

Run: `npx eslint app/api/checkout/route.ts components/store/CheckoutForm.tsx`
Expected: no new errors.

- [ ] **Step 7: Hand-trace the scenarios**

Write out, in your report, the result of tracing each of these against your actual modified code:
1. Both gateways disabled by mistake (shouldn't be reachable given Task 3's "at least one" guard, but trace what `app/api/checkout/route.ts` does if it somehow happened): both settings checks fail, checkout returns 400 for whichever `payment_type` was requested.
2. Client sends `payment_type: 'theteller'` while only Paystack is enabled server-side (e.g. a stale page that fetched settings before an admin disabled TheTeller): the settings check catches this and returns 400, not silently falling back to Paystack.
3. TheTeller's `/initiate` call throws (network error, bad credentials): the order is deleted (no ghost pending order), a 502 is returned — same pattern as the existing Paystack error path.

- [ ] **Step 8: Manual verification (requires `THETELLER_MERCHANT_ID`/`THETELLER_API_USER`/`THETELLER_API_KEY` set in `.env.local`, pointed at TheTeller's test endpoint — i.e. `THETELLER_LIVE` unset or `false`)**

With `npm run dev`, enable TheTeller in `/admin/payments` (from Task 3), go through checkout with TheTeller selected, confirm you're redirected to a real TheTeller-hosted checkout page (not an error). Do not need to complete the actual test payment for this task — that's covered in Task 5's verification.

- [ ] **Step 9: Commit**

```bash
git add app/api/checkout/route.ts components/store/CheckoutForm.tsx
git commit -m "feat: add TheTeller gateway selection to checkout"
```

---

### Task 5: Shared verification — generalize `processVerification`, add TheTeller redirect route

This is the highest-scrutiny task in this plan — it decides when a shop and a seller's wallet get credited. Treat it with the same rigor already established for every money-movement task this session: read the current file in full, trace every scenario by hand, verify with a real build.

**Files:**
- Modify: `app/api/payment/verify/route.ts`
- Create: `app/api/payment/theteller-verify/route.ts`

**Interfaces:**
- Consumes: `checkTransactionStatus` (Task 1); `orders.theteller_transaction_id` (Task 2).
- Produces: `processVerification` keeps its existing signature `(admin: SupabaseAdmin, orderId: string, reference: string) => Promise<{ ok: true } | { ok: false; error: string; code?: string }>` but is now exported from `app/api/payment/verify/route.ts` (it currently is not — needed by Task 6's reconciliation cron).

- [ ] **Step 1: Read the current file in full**

Read `app/api/payment/verify/route.ts` in full before editing.

- [ ] **Step 2: Modify `processVerification` in `app/api/payment/verify/route.ts`**

Add the import:

```ts
import { checkTransactionStatus } from '@/lib/theteller'
```

Change `async function processVerification(` to `export async function processVerification(` — this is the only change to its signature; the export keyword is added so Task 6 can import it.

Replace the body from the `order.paystack_reference !== reference` check through the `verifyTransaction` call with a gateway-aware version. The current relevant section is:

```ts
  if (!order || order.paystack_reference !== reference) {
    return { ok: false, error: 'Invalid order or reference', code: 'invalid_order' }
  }

  // Already processed (webhook may have beaten us)
  if (order.status !== 'pending') {
    return { ok: true }
  }

  const result = await verifyTransaction(reference)

  if (result.status === 'success') {
```

Replace it with:

```ts
  const expectedReference = order?.payment_type === 'theteller'
    ? order.theteller_transaction_id
    : order?.paystack_reference

  if (!order || expectedReference !== reference) {
    return { ok: false, error: 'Invalid order or reference', code: 'invalid_order' }
  }

  // Already processed (webhook, or a racing reconciliation-cron run, may have beaten us)
  if (order.status !== 'pending') {
    return { ok: true }
  }

  const result = order.payment_type === 'theteller'
    ? await checkTransactionStatus(reference).then((r) => ({
        success: r.code === '000',
        amount: Math.round(r.amount * 100), // GHS -> pesewas, matching Paystack's existing units
        channel: 'theteller',
        statusLabel: r.status, // e.g. 'approved', or a failure reason string — used only for the human-readable event/error text below, same role r.status played in the original Paystack-only code
      }))
    : await verifyTransaction(reference).then((r) => ({
        success: r.status === 'success',
        amount: r.amount, // already pesewas
        channel: r.channel,
        statusLabel: r.status,
      }))

  if (result.success) {
```

The rest of the function — the `expectedPesewas`/amount-mismatch check, the atomic `pending`→`paid` update, the stock decrement loop, the `creditShopEarnings` call, and the final `else` branch for a failed payment — stays exactly as it is, EXCEPT for field-name updates to match the normalized shape from the branch above:

- Every remaining reference to `result.amount` or `result.status === 'success'` stays `result.amount`/reads `result.success` instead (the normalized shape's fields).
- Every remaining reference to `result.channel` stays `result.channel` (the normalized shape kept this name deliberately, so this one is unchanged).
- **`result.reference` does NOT exist on the normalized shape** — the atomic update currently sets `payment_reference: result.reference`. The normalized object defined above does not carry a `reference` field, and it doesn't need one: the function's own `reference` PARAMETER (already validated against `expectedReference` at the top of the function, for both gateways) is exactly the value that belongs in `payment_reference` regardless of which gateway processed it. Change `payment_reference: result.reference` to `payment_reference: reference` (the bare parameter, not a property access).
- **In the failure `else` branch** (the one handling a non-success verification result), the description text currently reads `` `Payment ${result.status}.` `` and the returned error currently reads `` `Payment ${result.status}. Order cancelled.` `` — both use the raw Paystack status string. Change both to use `result.statusLabel` instead (the normalized shape's field carrying the same kind of human-readable status text for either gateway) — i.e. `` `Payment ${result.statusLabel}.` `` and `` `Payment ${result.statusLabel}. Order cancelled.` ``.

Read the current file's exact remaining lines after the `if (result.status === 'success') {` block (both the success branch AND the failure `else` branch) to find every one of these references and update each one precisely as described — do not leave a stale `result.status` or `result.reference` (from the old Paystack-shaped object) anywhere in the function body; a leftover `result.reference` would be `undefined` and silently null out `payment_reference` on every successful order regardless of gateway, and a leftover `result.status` in the failure branch would be `undefined` in the object literal (a property that was never defined on the normalized shape), producing a broken "Payment undefined." message — exactly the kind of one-line regression this self-review step exists to catch.

- [ ] **Step 3: Create `app/api/payment/theteller-verify/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processVerification } from '@/app/api/payment/verify/route'

// GET — TheTeller redirects the shopper's browser here after checkout,
// appending ?code=&status=&reason=&transaction_id= as query params.
// TheTeller has no inline-popup equivalent to Paystack's, so there is no
// POST handler in this route.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orderId = searchParams.get('order_id')
  const transactionId = searchParams.get('transaction_id')

  if (!orderId || !transactionId) {
    return NextResponse.redirect(new URL('/cart', req.url))
  }

  const admin = createAdminClient()

  try {
    const result = await processVerification(admin, orderId, transactionId)
    if (result.ok) {
      return NextResponse.redirect(new URL(`/orders/${orderId}?success=1`, req.url))
    } else {
      return NextResponse.redirect(new URL(`/orders/${orderId}?error=${result.code ?? 'error'}`, req.url))
    }
  } catch (err) {
    console.error('TheTeller verify error:', err)
    return NextResponse.redirect(new URL(`/orders/${orderId}?error=verify_failed`, req.url))
  }
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Run a real production build**

Run: `npm run build`
Expected: succeeds. Confirm both `/api/payment/verify` and `/api/payment/theteller-verify` appear in the route list.

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all passing, no regressions.

- [ ] **Step 7: Hand-trace every scenario, write the results in your report**

1. **Paystack order, paid successfully** — `order.payment_type` is `'paystack'` (existing orders, or new ones created via the Paystack path in Task 4). `expectedReference` resolves to `order.paystack_reference`. `verifyTransaction` is called, unchanged from before this task. Confirm the entire remaining flow (amount check, atomic update, stock decrement, `creditShopEarnings`) still fires identically to before — this is the regression case that must not break.
2. **TheTeller order, paid successfully** — `expectedReference` resolves to `order.theteller_transaction_id`. `checkTransactionStatus` is called; `result.success` is `true` when `code === '000'`; the atomic update and downstream logic fire using the normalized `result.amount`/`result.channel`.
3. **TheTeller order, redirect reference doesn't match the stored transaction ID** (e.g., a stale or tampered `transaction_id` query param) — `expectedReference !== reference` returns `invalid_order` before ever calling TheTeller's API.
4. **Order already processed** (webhook or a racing reconciliation-cron run beat this call) — `order.status !== 'pending'` returns `{ ok: true }` immediately, for both gateways, without a second `checkTransactionStatus`/`verifyTransaction` call.
5. **TheTeller order where the amount from `/status` doesn't match the order total** — confirm the existing amount-mismatch cancellation logic (which you did not modify) still fires correctly using the normalized `result.amount` in pesewas.

- [ ] **Step 8: Manual verification (requires TheTeller test credentials, same as Task 4's Step 8)**

Complete a real test payment through TheTeller's test checkout page (started via Task 4's flow), confirm the redirect back to `/orders/{id}?success=1` and that the order is now `status: 'paid'`.

- [ ] **Step 9: Commit**

```bash
git add app/api/payment/verify/route.ts app/api/payment/theteller-verify/route.ts
git commit -m "feat: generalize payment verification for TheTeller, add its redirect route"
```

---

### Task 6: Reconciliation cron

**Files:**
- Create: `app/api/cron/reconcile-theteller/route.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `processVerification` (Task 5, now exported).

- [ ] **Step 1: Read the current `app/api/payment/verify/route.ts` once more**

Confirm `processVerification` is exported as expected from Task 5, and note its exact import path for use here.

- [ ] **Step 2: Create `app/api/cron/reconcile-theteller/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processVerification } from '@/app/api/payment/verify/route'

// Vercel Cron sends this request automatically with the Authorization header
// set to `Bearer ${CRON_SECRET}` once that env var exists on the project —
// this is Vercel's own documented convention, not custom auth logic.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  const { data: staleOrders } = await admin
    .from('orders')
    .select('id, theteller_transaction_id')
    .eq('payment_type', 'theteller')
    .eq('status', 'pending')
    .lt('created_at', tenMinutesAgo)
    .not('theteller_transaction_id', 'is', null)

  const results = []
  for (const order of staleOrders ?? []) {
    const result = await processVerification(admin, order.id, order.theteller_transaction_id!)
    results.push({ orderId: order.id, ok: result.ok })
  }

  return NextResponse.json({ checked: results.length, results })
}
```

- [ ] **Step 3: Create `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/reconcile-theteller", "schedule": "*/5 * * * *" }
  ]
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Run a real production build**

Run: `npm run build`
Expected: succeeds. Confirm `/api/cron/reconcile-theteller` appears in the route list.

- [ ] **Step 6: Hand-trace the scenarios**

1. **Request with no `Authorization` header, or the wrong value** — `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` is true, returns 401 before any database query runs.
2. **A TheTeller order created 3 minutes ago, still pending** — excluded by the `.lt('created_at', tenMinutesAgo)` filter, not touched, correctly left alone since it may still be mid-checkout.
3. **A TheTeller order created 15 minutes ago, still pending, and the shopper actually completed payment on TheTeller's page** — included in `staleOrders`, `processVerification` is called with its stored `theteller_transaction_id`, `checkTransactionStatus` confirms success, the order is credited via the exact same path Task 5's redirect route would have used.
4. **A TheTeller order created 15 minutes ago, still pending, and the shopper actually abandoned it** — `processVerification` calls `checkTransactionStatus`, gets a non-`'000'` code, the existing failed-payment branch (unmodified, from before this whole plan) cancels the order.
5. **Two reconciliation runs racing an in-flight redirect verification for the same order** — `processVerification`'s existing `.eq('status', 'pending')` atomic guard (unmodified by this plan) ensures only one of the two ever successfully transitions the order past `pending`; the other's update matches 0 rows and it stops before crediting anything twice.

- [ ] **Step 7: Manual verification**

With `.env.local` containing a real `CRON_SECRET` value, and `npm run dev` running, manually trigger the route with `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reconcile-theteller` (substitute the real secret value, don't paste it into any committed file or report) and confirm a `200` with a JSON body listing `checked` and `results`. Confirm a request with a wrong/missing header gets `401`.

- [ ] **Step 8: Commit**

```bash
git add app/api/cron/reconcile-theteller/route.ts vercel.json
git commit -m "feat: add reconciliation cron for stuck-pending TheTeller orders"
```
