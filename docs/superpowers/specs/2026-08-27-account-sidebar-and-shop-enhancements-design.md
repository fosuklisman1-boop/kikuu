# Account Sidebar & Shop Enhancements — Design

## Goal

Four related but independent improvements to the customer/seller experience:

1. Replace the navbar's small profile dropdown with a proper slide-out sidebar.
2. Give the seller dashboard real stat cards instead of a single count.
3. Let a shop owner add a product to their shop directly from the main marketplace browsing pages, not just from the dedicated seller area.
4. Let shops sell pre-order products, with the seller's profit deferred until the admin marks the order delivered instead of paid at purchase.

None of these require a database migration. All four reuse existing server actions, types, and UI patterns already in the codebase — no new subsystems.

## 1. Profile Sidebar

**Problem:** `components/store/NavbarRow1.tsx` (desktop-only navbar row, `NavbarRow1` is not rendered on mobile — mobile has its own simplified header and relies on `BottomTabBar.tsx`'s "Account" tab linking straight to `/account`) currently renders a small anchored dropdown (lines 130–202) on click of the user avatar: a cramped header row, then Dashboard / My Orders / Wishlist / Profile & Addresses, then Sign Out.

**Change:** Replace that dropdown block with a new component, `components/store/ProfileSidebar.tsx`, styled after the existing `components/seller/SellerSidebar.tsx` drawer pattern (`framer-motion` backdrop + slide-in panel, `AnimatePresence`) but themed in the storefront's cream/amber palette (`#fafaf8`, `#ede8df`, `#b45309`) instead of the seller dashboard's dark palette, and sliding in from the **right** (matching where the avatar trigger sits).

**Content**, top to bottom — matches `components/store/AccountSidebar.tsx`'s existing nav list exactly, since that's the canonical "what's in a customer's account" list already used inside `/account/*` pages:
1. Profile card: avatar initials, full name, email.
2. Dashboard (`/account`)
3. My Orders (`/account/orders`)
4. Wishlist (`/account/wishlist`) — with the existing badge count
5. Profile & Addresses (`/account/profile`)
6. My Shop / Sell on Kikuu (`shopHref`/`shopLabel`, conditional on whether the user has a shop — same logic `AccountLayout` already computes for `AccountSidebar`)
7. Sign Out

**Interface:**
```ts
interface ProfileSidebarProps {
  displayName: string
  email: string
  initials: string
  wishlistCount: number
  shopHref: string
  shopLabel: string
  open: boolean
  onClose: () => void
}
```

`NavbarRow1.tsx` keeps its existing `user`/`userMenuOpen` state and click-outside logic is replaced by the drawer's own backdrop-click-to-close (matching `SellerSidebar`'s pattern) — the `userMenuRef`/mousedown-listener code is removed since a backdrop makes it redundant. `NavbarRow1` needs to know whether the user has a shop to compute `shopHref`/`shopLabel`; it currently only calls `supabase.auth.getUser()` client-side. Add one more client-side call: `getMyShop()` is a `'use server'` action, callable from a Client Component, so `NavbarRow1` calls it alongside the existing `auth.getUser()` effect.

## 2. Dashboard Stat Cards

**Problem:** `app/seller/(shop)/dashboard/page.tsx` shows exactly one stat card ("Products in shop").

**Change:** Add three more cards, all reusing existing read functions — no new queries:
- **Wallet Balance** — `getWalletBalance()` (already in `lib/actions/wallet.ts`)
- **Withdrawable Now** — `getWithdrawableBalance()` (already in `lib/actions/wallet.ts`, wraps `computeWithdrawableBalance`)
- **Total Orders** — new: count of `orders` where `shop_id` matches this shop (any status)
- **Pending Orders** — new: count of `orders` where `shop_id` matches and `status` is one of `pending`, `paid`, `processing`, `shipped` (i.e., not yet `delivered`/`cancelled`/`refunded`)

The two new counts need one new function, `getShopOrderStats()`, added to `lib/actions/shop-products.ts` (co-located with the other shop-owner-scoped read functions in that file) — derives `shopId` via `requireShopOwner()`, never takes it as a parameter, matching this codebase's established convention everywhere else in the shop/wallet code:

```ts
export async function getShopOrderStats(): Promise<{ total: number; pending: number }> {
  const { shopId } = await requireShopOwner()
  const admin = createAdminClient()
  const [{ count: total }, { count: pending }] = await Promise.all([
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('shop_id', shopId)
      .in('status', ['pending', 'paid', 'processing', 'shipped']),
  ])
  return { total: total ?? 0, pending: pending ?? 0 }
}
```

`app/seller/(shop)/dashboard/page.tsx` calls all four read functions in parallel (`Promise.all`) alongside its existing `getShopProductsPriced()` call, and renders four cards in the existing `grid grid-cols-2 sm:grid-cols-3` — no layout restructuring needed, just more cards in the same grid.

## 3. Add-to-Shop While Browsing

**Problem:** The only way to add a product to a shop today is via `/seller/products`'s "Browse Catalog" tab. A shop owner casually browsing the main marketplace (`/products`, `/products/[slug]`) has no quick way to add what they're looking at to their own shop.

**Change:** Both main-site product pages already run server-side (`app/(store)/products/page.tsx`, `app/(store)/products/[slug]/page.tsx`), so each fetches `getMyShop()` once per page load (already exists, already used elsewhere, no new server logic) and passes down whether the viewer owns a shop (and its `shopId`, for the add call) as props.

`components/store/ProductCard.tsx` and the product detail page gain a small "Add to My Shop" affordance, visible **only** when the viewer owns a shop:
- A compact icon button (e.g. a small storefront icon, positioned near the existing wishlist heart icon on `ProductCard`) that, on click, opens an inline popover containing the existing `components/seller/MarkupForm.tsx` (already a small, self-contained, controlled component — reusable as-is, no changes needed to it) and an "Add" button.
- Calls the existing `addShopProducts({ productIds: [product.id], markupType, markupValue })` (already in `lib/actions/shop-products.ts`, already validates via `requireShopOwner()` — no new server code) with a one-item array.
- On success, shows the same kind of transient confirmation `ProductCard` already uses for "Added to cart" (brief inline state change, no page navigation).

This is purely a new UI entry point into code that already exists and is already tested by the seller-side flow — no new validation, no new authorization logic, no new database writes.

## 4. Pre-order Shop Support + Delivery-Triggered Earnings

### 4a. Un-exclude pre-order products from shops

Three query filters currently exclude `pre_order` products from every shop-related surface — each changes from `.eq('status', 'active')` to `.in('status', ['active', 'pre_order'])`:

1. `app/seller/(shop)/products/page.tsx` line 13 — the "available to add" query for the Browse Catalog tab.
2. `app/(store)/shop/[slug]/page.tsx` line 45 — the shop storefront listing.
3. `app/(store)/shop/[slug]/[productSlug]/page.tsx` line 42 — the shop product detail page.

`components/store/ShopProductCard.tsx` already treats pre-order products correctly for stock purposes (`outOfStock = product.stock_qty === 0 && product.status !== 'pre_order'`, line 25) — it just needs the same "Delivers in N days" badge `components/store/ProductCard.tsx` already renders (lines 146–148) using `product.preorder_days`, added to the card's image or info area.

`app/(store)/shop/[slug]/[productSlug]/page.tsx` already computes `isPreorder` (line 56) and already correctly treats pre-order as always-in-stock (line 57, `inStock = product.stock_qty > 0 || isPreorder`) — this logic is currently unreachable dead code because the query filter excludes pre-order products before it ever runs. Once the filter is relaxed, this page needs one addition: render a "Delivers in N days" note near the stock-status badge when `isPreorder` is true, matching the main site's product detail page treatment.

No changes needed to `ShopProductPicker.tsx` (the seller's Browse Catalog UI) beyond what the relaxed query filter already provides — the same "Delivers in N days" badge pattern is worth adding to its product grid cards too, for consistency, though it's cosmetic only.

### 4b. Cart already prevents the hard case

`lib/cart.ts` (lines 69–76) already blocks mixing pre-order and regular items in the same cart, and already blocks mixing items from two different shops (or a shop and the main site) in the same cart, each with its own explicit error message. This means a shop order is always **entirely** pre-order or **entirely** regular — never both. Confirmed by reading the existing cart store logic, not assumed.

This eliminates any need for per-item earnings splitting or a schema change. The existing order-level `orders.is_preorder` boolean (already computed and stored by `app/api/checkout/route.ts`, already generic across shop and non-shop orders) is sufficient.

### 4c. Order-level earnings gating

`lib/wallet-ledger.ts`'s `creditShopEarnings(orderId)` currently credits as soon as `payment_status === 'paid'`, regardless of order type. Change:

```ts
export async function creditShopEarnings(orderId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('shop_id, order_number, items, payment_status, is_preorder, status')
    .eq('id', orderId)
    .single()

  if (orderError) throw new Error(orderError.message)
  if (!order?.shop_id) return
  if (order.payment_status !== 'paid') return
  if (order.is_preorder && order.status !== 'delivered') return

  // ...unchanged from here (compute amount, insert wallet_transactions row)
}
```

Two fields added to the existing select (`is_preorder`, `status`), one new guard line. Everything below it — the `computeOrderEarnings` call, the insert, the `23505` idempotency swallow — is unchanged.

This one change correctly handles both cases with no other logic needed:
- **Non-preorder shop order:** `is_preorder` is `false`, the new guard is a no-op, credits at payment exactly as today.
- **Pre-order shop order:** `is_preorder` is `true`; at payment-confirmation time `status` is `'paid'` (not yet `'delivered'`), so the function returns without crediting. Crediting is deferred.

### 4d. New trigger at delivery

`lib/actions/products.ts`'s `updateOrderStatus(orderId, status)` currently calls `reverseShopEarnings(orderId)` when transitioning to `cancelled`/`refunded` (line 131–133). Add a parallel call for the `delivered` transition:

```ts
if (status === 'delivered' && order?.shop_id) {
  await creditShopEarnings(orderId)
}
```

Placed alongside the existing `reverseShopEarnings` conditional, using the same `order` object already fetched at the top of the function (which already selects `shop_id`; add `payment_status` is already selected too — no new fetch needed, only `is_preorder`/`status` inside `creditShopEarnings` itself needs the extra columns, not here).

For a **non-preorder** order reaching `delivered` (already credited at payment time), this call is a safe no-op: `creditShopEarnings` re-fetches the order fresh, sees `is_preorder = false`, and attempts its normal insert — which the existing `wallet_transactions` unique constraint on `(order_id, type)` rejects as a duplicate, caught and swallowed by the existing `error.code !== '23505'` check. No new failure mode, reusing the exact idempotency pattern already in place.

For a **pre-order** order reaching `delivered`, this is the moment it actually gets credited for the first time.

`confirmCodPayment` (the COD-specific path, which already sets `status: 'delivered'` and `payment_status: 'paid'` in the same update, then immediately calls `creditShopEarnings`) needs no changes — COD delivery and COD payment confirmation are already the same moment in this codebase, so the new rule is already naturally satisfied there.

### 4e. Reversal

`reverseShopEarnings` already queries for an existing `credit` transaction and returns early if none exists (`lib/wallet-ledger.ts` line 54, `if (!credit) return`). This already correctly handles cancelling a pre-order shop order before it's ever been credited — there's nothing to reverse, and the function already says so safely. No change needed.

## Testing

- `lib/wallet-ledger.test.ts` (new or extended, wherever the existing wallet-ledger tests for `creditShopEarnings`/`reverseShopEarnings` live — check for an existing test file first): add cases for the new guard — a paid, non-delivered pre-order shop order does NOT get credited; the same order credited once it's marked delivered; a non-preorder order is unaffected by the new guard.
- `lib/actions/shop-products.test.ts` or equivalent: `getShopOrderStats()` returns correct total/pending counts.
- Manual verification (no automated UI tests in this codebase's convention for component-level interaction): profile sidebar opens/closes/navigates correctly on both a fresh page and after client-side navigation; dashboard cards render with real numbers; add-to-shop-while-browsing round-trips into `/seller/products`'s Manage tab; a pre-order shop product can be added to a shop, appears with a "Delivers in N days" badge on the shop storefront, can be purchased, and the seller's wallet balance does NOT increase until an admin marks the order delivered.

## Global Constraints (carried into the implementation plan)

- Every server action follows the established `requireShopOwner()`/`requireAdmin()` convention — never trust a client-supplied `shopId`.
- `lib/wallet-ledger.ts` stays a plain (non-`'use server'`) module, as it already is — no change to that.
- Any task touching a `'use server'` file requires a real `npm run build`, not just `tsc --noEmit`, per this project's standing rule (a past production incident was invisible to `tsc`/Vitest alike).
- No database migration in this feature — everything reuses existing columns and constraints.
