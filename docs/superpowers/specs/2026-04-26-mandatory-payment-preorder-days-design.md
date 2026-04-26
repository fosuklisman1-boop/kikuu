# Spec: Mandatory Payment & Pre-order Delivery Days

**Date:** 2026-04-26
**Status:** Approved

---

## Overview

Two related changes to the order and pre-order system:

1. **Remove COD (Cash on Delivery)** — all orders must be paid upfront via Paystack. No exceptions.
2. **Pre-order delivery date = purchase date + admin-set days** — replace the fixed calendar date picker on pre-order products with a relative offset (days + optional note). The absolute delivery date is computed at checkout time and stored on the order.

---

## Database Schema

### `products` table

| Change | Column | Type | Notes |
|--------|--------|------|-------|
| Remove | `preorder_ship_date` | date | Replaced by days-based approach |
| Add | `preorder_days` | integer, nullable | Days from purchase to expected delivery. Required when `status = 'pre_order'` |
| Add | `preorder_note` | text, nullable | Optional admin description (e.g. "arrives before Christmas") |

Migration must:
- Add `preorder_days` and `preorder_note` columns
- Drop `preorder_ship_date` column
- Any existing pre-order products with a `preorder_ship_date` should have `preorder_days` set to `null` (admin will re-enter)

### `orders` table

No column changes. The existing `pre_order_ship_date` (date) column stays — its value is now computed at checkout as `NOW() + preorder_days` instead of being copied from the product.

### `order_items` JSONB (inside `orders.items`)

Each item in the array gains one new field:

| Field | Type | Notes |
|-------|------|-------|
| `preorder_note` | string \| null | Copied from product at checkout time |

The existing `preorder_ship_date` field on each item is kept — now set to the computed date.

### TypeScript types (`lib/supabase/types.ts`)

- `Product`: remove `preorder_ship_date`, add `preorder_days: number | null`, `preorder_note: string | null`
- `OrderItem`: add `preorder_note: string | null`

### Cart types (`lib/cart.ts`)

- `CartItem`: remove `preorder_ship_date: string | null`, add `preorder_days: number | null` and `preorder_note: string | null`
- `deriveCart`: remove `latestPreorderDate` (no longer needed — dates computed server-side at checkout)
- When adding to cart (`addItem`), copy `product.preorder_days` and `product.preorder_note` instead of `product.preorder_ship_date`

### Add-to-cart button (`components/store/AddToCartButton.tsx`)

- Pass `preorder_days` and `preorder_note` from product into the cart item instead of `preorder_ship_date`

---

## Checkout API (`app/api/checkout/route.ts`)

### COD removal

- `CheckoutSchema.payment_type` changes from `z.enum(['paystack', 'cod'])` to `z.literal('paystack')`
- Remove all `isCod` branching logic
- Remove COD stock decrement path
- `initialStatus` is always `'pending'`
- `initialPaymentStatus` is always `'pending'`
- Remove the pre-order COD enforcement error response

### Pre-order date computation

When building `orderItems`, for any product with `status === 'pre_order'`:

```
expectedDeliveryDate = new Date(NOW + preorder_days * 86400000)
  formatted as YYYY-MM-DD
```

This computed date is stored as:
- `item.preorder_ship_date` on the order item
- `order.pre_order_ship_date` (latest date across all pre-order items, computed at order-creation time)

`item.preorder_note` is copied directly from `product.preorder_note`.

### Product query

Update the Supabase select to fetch `preorder_days, preorder_note` instead of `preorder_ship_date`.

---

## Admin UI (`components/admin/ProductForm.tsx`)

When `selectedStatus === 'pre_order'`, replace the date picker with:

**"Days until delivery" (required)**
- `<input type="number" name="preorder_days" min="1" max="365" />`
- Helper: *"Customer receives order this many days after purchase."*

**"Delivery note" (optional)**
- `<input type="text" name="preorder_note" maxLength="100" />`
- Placeholder: *e.g. arrives before Christmas*
- Helper: *"Shown to customers alongside the expected delivery date."*

### `lib/actions/products.ts`

- Zod schema: replace `preorder_ship_date` with `preorder_days` (integer) and `preorder_note` (string, optional)
- `createProduct` / `updateProduct`: write `preorder_days` and `preorder_note` to DB; write `null` for both when status is not `pre_order`

---

## Checkout UI (`components/store/CheckoutForm.tsx`)

- Remove the COD payment card entirely
- Remove the pre-order COD notice banner
- Remove `hasPreorderItems` forced COD logic — `effectivePaymentType` is always `'paystack'`
- In the order summary, for pre-order items show computed expected delivery date:
  *"Expected delivery: {format(today + preorder_days, 'dd MMM yyyy')}"*
- If `preorder_note` is set, show it below the date in muted text

---

## Order Detail Page (`app/(store)/orders/[id]/page.tsx`)

- Where `pre_order_ship_date` is displayed, also render `preorder_note` from the order item if present
- No structural changes needed — date is already stored correctly on the order

---

## Payment Verify & Webhook

No changes needed. Both routes already handle only Paystack, and the stock/status update logic is correct.

---

## Out of Scope

- Admin order management UI (date column already reads from `pre_order_ship_date` on the order — no change needed)
- Refund or cancellation flows
- SMS/email delivery date notifications
