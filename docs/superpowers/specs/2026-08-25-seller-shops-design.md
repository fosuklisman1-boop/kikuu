# Seller Shops & Product Curation — Design Spec

**Sub-project 1 of 4** in the seller-shops initiative:

1. **Shops & Product Curation** ← this spec
2. Subdomain routing (each shop gets a unique subdomain)
3. Order attribution & earnings ledger (wallet balance grows from sales)
4. Withdrawals (cash out wallet balance via Paystack Transfers / MTN MoMo)

Explicitly **out of scope** here: subdomains (shops are reached via `/shop/[slug]` for now — sub-project 2 makes a subdomain rewrite to the same route, no app-logic changes needed later), any wallet/balance tracking, and withdrawals. This spec only gets a seller from "I want to sell" to "a customer can buy from my shop at my price" — the money-movement side comes later.

## Goal

Let any logged-in customer open one shop, curate products from the existing catalog into it, and set their own resale price (flat GHS markup or % markup, with bulk apply across many products at once). The main Kikuu site keeps selling at base admin prices unchanged; shops are an additional resale channel on the same catalog and the same shared stock.

## Architecture

**Tech stack:** Next.js 16 App Router, Supabase (Postgres + RLS), Zustand for cart state, Zod for server-side validation — matches the rest of the app.

One user owns at most one shop (`shops.owner_id` is `unique`). A shop doesn't hold its own inventory — `shop_products` is a pure curation + pricing join between a shop and the existing `products` table. Resale price is never stored directly; it's always derived from the product's current base price plus the seller's markup, via a SQL view (`shop_products_priced`), so a base-price change by admin automatically flows through to every shop selling that product without any sync job. Past orders are unaffected because the price actually charged is already snapshotted into `orders.items` at checkout time (existing pattern, unchanged).

"Seller" is not a new role — `public.users.role` stays `customer`/`admin` exactly as today. Being a seller means owning a row in `shops`. This keeps `is_admin()` / `requireAdmin()` (see [[security-conventions]]) completely untouched; a new `requireShopOwner()` guard is added alongside it, following the identical pattern (service-role lookup, throws on failure).

---

## Database (migration `016_seller_shops.sql`)

```sql
-- ============================================================
-- SHOPS
-- ============================================================
create table public.shops (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references auth.users(id) on delete cascade,
  name        text not null,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index shops_slug_idx on public.shops(slug);

create trigger shops_updated_at
  before update on public.shops
  for each row execute function public.set_updated_at();

alter table public.shops enable row level security;

create policy "shops_public_read" on public.shops
  for select using (active = true);

create policy "shops_owner_read" on public.shops
  for select using (auth.uid() = owner_id);

-- ============================================================
-- SHOP PRODUCTS (curation + pricing)
-- ============================================================
create table public.shop_products (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  markup_type   text not null check (markup_type in ('flat', 'percentage')),
  markup_value  numeric(12, 2) not null check (markup_value >= 0),
  created_at    timestamptz not null default now(),
  unique (shop_id, product_id)
);

create index shop_products_shop_id_idx on public.shop_products(shop_id);
create index shop_products_product_id_idx on public.shop_products(product_id);

alter table public.shop_products enable row level security;

create policy "shop_products_public_read" on public.shop_products
  for select using (
    exists (select 1 from public.shops s where s.id = shop_id and s.active = true)
  );

create policy "shop_products_owner_write" on public.shop_products
  for all using (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  );

-- Derived pricing — never stored, always current with base product price.
-- security_invoker makes the view respect RLS on shop_products/products for
-- direct (anon-client) reads; checkout still recomputes authoritatively via
-- the admin client, matching the existing flash-sale pricing pattern.
create view public.shop_products_priced
  with (security_invoker = true) as
select
  sp.id,
  sp.shop_id,
  sp.product_id,
  sp.markup_type,
  sp.markup_value,
  p.price as base_price,
  case sp.markup_type
    when 'flat' then p.price + sp.markup_value
    else round(p.price * (1 + sp.markup_value / 100), 2)
  end as shop_price,
  sp.created_at
from public.shop_products sp
join public.products p on p.id = sp.product_id;

-- ============================================================
-- ORDERS: shop attribution
-- ============================================================
alter table public.orders add column shop_id uuid references public.shops(id) on delete set null;
create index orders_shop_id_idx on public.orders(shop_id);
```

---

## Type system (`lib/supabase/types.ts`)

Add table entries following the existing hand-written pattern:

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
shop_products: {
  Row: {
    id: string
    shop_id: string
    product_id: string
    markup_type: 'flat' | 'percentage'
    markup_value: number
    created_at: string
  }
  Insert: Omit<Database['public']['Tables']['shop_products']['Row'], 'id' | 'created_at'>
  Update: Partial<Database['public']['Tables']['shop_products']['Insert']>
}
```

Add `shop_id: string | null` to the existing `orders.Row`.

Convenience types:

```ts
export type Shop = Database['public']['Tables']['shops']['Row']
export type ShopProduct = Database['public']['Tables']['shop_products']['Row']

// Shape of a row read from shop_products_priced, joined with the product itself
export interface ShopProductPriced {
  id: string
  shop_id: string
  product_id: string
  markup_type: 'flat' | 'percentage'
  markup_value: number
  base_price: number
  shop_price: number
  created_at: string
  product: Product
}
```

---

## Auth guard (`lib/auth/require-shop-owner.ts`) — new file

Mirrors `requireAdmin()` exactly: service-role lookup, throws on failure, called at the top of every mutating seller action.

```ts
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function requireShopOwner(): Promise<{ userId: string; shopId: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { data: shop } = await admin
    .from('shops')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!shop) throw new Error('Forbidden: no shop found for this user')
  return { userId: user.id, shopId: shop.id }
}
```

---

## Server actions

### `lib/actions/shops.ts` — new file

```ts
'use server'
export async function checkSlugAvailable(slug: string): Promise<boolean>
export async function createShop(formData: FormData): Promise<{ error?: string }>
export async function getMyShop(): Promise<Shop | null>
```

`createShop`: requires a logged-in user (not `requireShopOwner` — they don't have a shop yet), rejects if `getMyShop()` already returns one (enforces one-shop-per-user at the app layer too, not just the DB constraint, so the error message is friendly), validates `{ name, slug }` with a Zod schema (`slug: z.string().regex(/^[a-z0-9-]{3,40}$/)`). The onboarding form runs the existing `slugify()` helper (`lib/utils.ts`, already used by `lib/actions/products.ts`) on the shop name to suggest a starting slug, which the user can then edit before the availability check runs. Inserts via `createAdminClient()`, `revalidatePath('/seller')`, `redirect('/seller/dashboard')`.

### `lib/actions/shop-products.ts` — new file

```ts
'use server'
export async function addShopProducts(input: {
  productIds: string[]
  markupType: 'flat' | 'percentage'
  markupValue: number
}): Promise<{ error?: string }>

export async function updateShopProductMarkup(
  shopProductId: string,
  markupType: 'flat' | 'percentage',
  markupValue: number
): Promise<{ error?: string }>

export async function removeShopProduct(shopProductId: string): Promise<{ error?: string }>

export async function getShopProductsPriced(shopId: string): Promise<ShopProductPriced[]>
```

`addShopProducts` is the single entry point for both the single-add and bulk-add UI — bulk is simply `productIds.length > 1`. Implementation: `requireShopOwner()`, validate `markupValue >= 0`, `upsert` one row per product id with `onConflict: 'shop_id,product_id'` (re-adding an already-curated product just updates its markup). All mutations call `revalidatePath('/seller/products')`.

---

## Seller area (`app/seller/*`)

### `app/seller/layout.tsx` — new file

Follows the admin layout's service-role-lookup style (the research flagged this as the "documented always works" pattern vs. the account layout's RLS-reliant style — picking the admin-client style deliberately here):

```ts
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import SellerSidebar from '@/components/seller/SellerSidebar'

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/account/login?redirect=/seller')

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('*').eq('owner_id', user.id).single()
  if (!shop) redirect('/seller/onboarding')

  return (
    <div className="flex h-screen bg-gray-100">
      <SellerSidebar shopName={shop.name} shopActive={shop.active} />
      <main className="flex-1 min-w-0 overflow-auto p-4 lg:p-6 pt-16 lg:pt-6">{children}</main>
    </div>
  )
}
```

`app/seller/onboarding/page.tsx` sits outside this layout (its own minimal layout — just the auth check, no shop-required redirect, otherwise it'd redirect-loop). Form: shop name + slug input with a debounced `checkSlugAvailable()` call showing a live ✓/✗, submits to `createShop()`.

`app/seller/dashboard/page.tsx` — for v1, just shop info + a "View your shop" link + product count. Real earnings/stats land in sub-project 3.

`app/seller/products/page.tsx` — the curation UI, two sections:
- **Browse catalog**: reuses the existing product grid/search, each card gets a checkbox. A sticky bulk-action bar appears once ≥1 product is selected: markup type toggle (flat GHS / %) + value input + live price preview + "Apply to N products" → `addShopProducts()`.
- **My shop products**: table from `getShopProductsPriced()` — product, base price, markup, resulting shop price, edit/remove actions.

### `components/seller/SellerSidebar.tsx` — new file

Same structure as `AdminSidebar` (nav array + `usePathname()` active state):

```ts
const NAV = [
  { href: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/seller/products', label: 'Products', icon: Package },
]
```
(Wallet/Orders nav items get added in sub-projects 3–4.)

### `components/seller/MarkupForm.tsx` — new file

Shared inline control used both for single-product markup entry and the bulk-apply bar: flat/% toggle, numeric value input, live computed price preview (needs the base price as a prop to preview against).

### `proxy.ts` — modify

Add `/seller/:path*` to the `matcher` array and the same unauthenticated-redirect branch used for `/admin`:

```ts
if (request.nextUrl.pathname.startsWith('/seller')) {
  if (!user) {
    return NextResponse.redirect(new URL('/account/login?redirect=/seller', request.url))
  }
}
```
(Shop-ownership enforcement stays in the layout + `requireShopOwner()`, same division of responsibility as `/admin`.)

---

## Public storefront

### `app/(store)/shop/[slug]/page.tsx` — new file

Server component: fetch the shop by slug (404 if missing or `active = false`), fetch `shop_products_priced` joined to `products` (filtered to `status = 'active'`) for that shop, render with the existing `ProductCard`-style grid but showing `shop_price`.

### `app/(store)/shop/[slug]/[productSlug]/page.tsx` — new file

Shop-scoped product detail — same layout as `app/(store)/products/[slug]/page.tsx`, priced via `shop_products_priced` instead of `products.price`. "Add to Cart" passes shop context (`shopId`, `shopSlug`) down to `AddToCartButton`.

---

## Cart changes (`lib/cart.ts`)

Cart is locked to one source at a time (confirmed decision — avoids split-shipping/multi-seller order complexity):

```ts
export interface CartState {
  // ...existing fields...
  shopId: string | null
  shopSlug: string | null
}
```

`addItem` gains the same kind of guard already used for the pre-order/regular mixing rule: if the cart is non-empty and the item's shop context (`shopId ?? null`) differs from the cart's current `shopId`, return `{ error: 'Your cart has items from another store — clear it or finish checkout first.' }`. When the cart becomes empty (last item removed, or `clearCart()`), reset `shopId`/`shopSlug` to `null` so a new source can start fresh — same lifecycle as the existing cart-clearing behavior.

`AddToCartButton` gets two new optional props (`shopId?`, `shopSlug?`), forwarded into `addItem`.

---

## Checkout integration (`app/api/checkout/route.ts`)

- `CheckoutSchema` gains `shop_id: z.string().uuid().optional()`.
- When `shop_id` is present: verify the shop exists and `active = true` (404/400 otherwise), and price every item from `shop_products_priced` (`shop_id` + `product_id`) instead of the existing `flashPrices.get(product.id) ?? product.price` lookup. **Shop purchases don't stack with flash-sale pricing in v1** — keeps "what price did the customer actually pay" unambiguous for the future earnings ledger (sub-project 3).
- Insert `shop_id` onto the order row (`null` for main-site checkouts, unchanged behavior).
- Stock validation stays exactly as today — same shared `products.stock_qty`, no per-shop inventory. Stock decrement (`payment/verify/route.ts`, `webhooks/paystack/route.ts`) needs **no changes** — both already key off `product_id` + `quantity`, agnostic to which channel sold it.

`components/store/CheckoutForm.tsx`: reads `shopId` from the cart store and includes it in the POST body when present.

---

## Error handling & edge cases

- **Slug collisions**: live-checked via `checkSlugAvailable()` and backstopped by the DB `unique` constraint.
- **Base price changes after curation**: `shop_price` is derived from `shop_products_priced`, so it updates automatically — no sync job, no stale prices. Already-placed orders are unaffected since `orders.items` snapshots the price actually charged (existing behavior, unchanged).
- **Product deactivated/out of stock**: automatically disappears from every shop's storefront via the `status = 'active'` filter on the join — no extra bookkeeping in `shop_products`.
- **Shop deactivated by admin** (future moderation lever — this spec only adds the `active` column, not an admin UI for it): public storefront 404s; the seller's own `/seller/*` dashboard stays accessible so they can see why/fix it, only the public-facing side is gated.
- **One shop per user**: enforced at both the DB (`unique` on `owner_id`) and app layer (`createShop` checks `getMyShop()` first) so the failure is a friendly message, not a raw constraint violation.
- **Negative/zero-effect markup**: `markup_value >= 0` check constraint prevents reselling below base price.

---

## Testing

- **Migration/constraint tests**: unique `slug`, unique `owner_id`, unique `(shop_id, product_id)`, `markup_value >= 0` check, `slug` format check.
- **RLS tests**: shop owner can insert/update/delete only their own `shop_products` rows; cannot touch another shop's rows; anonymous/public read only returns rows for `active = true` shops.
- **`requireShopOwner()` unit tests**: throws for unauthenticated, throws for a user with no shop, returns the correct `shopId` for a valid owner.
- **`addShopProducts` test**: bulk-applies one markup to N products in a single call; re-adding an existing product updates its markup instead of erroring.
- **Pricing test**: `shop_products_priced` computes correctly for both `flat` and `percentage`, and reflects a base-price change immediately without touching `shop_products`.
- **Cart guard test**: adding an item from a different shop into a non-empty cart returns an error; cart's shop context resets to `null` once emptied.
- **Checkout integration test**: an order placed via `/shop/[slug]` charges `shop_price` and stores `shop_id`; an order placed via the main site has `shop_id = null` and charges base/flash price as today.

---

## File summary

| Action | File |
|--------|------|
| Create | `supabase/migrations/016_seller_shops.sql` |
| Modify | `lib/supabase/types.ts` |
| Create | `lib/auth/require-shop-owner.ts` |
| Create | `lib/actions/shops.ts` |
| Create | `lib/actions/shop-products.ts` |
| Modify | `lib/cart.ts` |
| Modify | `components/store/AddToCartButton.tsx` |
| Create | `components/seller/SellerSidebar.tsx` |
| Create | `components/seller/MarkupForm.tsx` |
| Create | `components/seller/ShopProductPicker.tsx` |
| Create | `app/seller/layout.tsx` |
| Create | `app/seller/onboarding/page.tsx` |
| Create | `app/seller/dashboard/page.tsx` |
| Create | `app/seller/products/page.tsx` |
| Create | `app/(store)/shop/[slug]/page.tsx` |
| Create | `app/(store)/shop/[slug]/[productSlug]/page.tsx` |
| Modify | `app/api/checkout/route.ts` |
| Modify | `components/store/CheckoutForm.tsx` |
| Modify | `proxy.ts` |
