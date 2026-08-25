# Seller Shops & Product Curation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any logged-in customer open one shop, curate existing catalog products into it at their own price (flat GHS or % markup, with bulk apply), and sell them at `/shop/[slug]` alongside the unchanged main-site storefront.

**Architecture:** New `shops` and `shop_products` tables plus a `shop_products_priced` SQL view derive resale price from the product's live base price + the seller's markup (never stored, always current). "Seller" is not a new role — it's just "owns a row in `shops`" — enforced by a new `requireShopOwner()` guard mirroring the existing `requireAdmin()` pattern. A new `/seller/*` area (mirroring `/admin`) lets sellers curate products; a new `/shop/[slug]` public area (mirroring `/products`) is the storefront. Checkout gains an optional `shop_id` that switches pricing to the shop's price and stamps the order.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), Zustand for cart state, Zod for validation, Vitest for pure-logic unit tests (new — this repo has no test runner today).

**Spec:** [docs/superpowers/specs/2026-08-25-seller-shops-design.md](../specs/2026-08-25-seller-shops-design.md)

## Global Constraints

- One shop per user (`shops.owner_id` is `unique`).
- Markup is never negative: `shop_products.markup_value >= 0` (DB check constraint).
- Shop purchases do **not** stack with flash-sale pricing in v1.
- Cart is locked to one source (main site OR one shop) at a time — no mixing.
- `public.users.role` stays `customer`/`admin` only — being a seller never changes this column.
- This repo has no existing test runner or test files. Tasks that produce pure, DB-free logic (pricing math, the shop-owner guard, the cart store, Zod schemas) get real Vitest unit tests. Tasks that touch the database (migrations, RLS, server actions using `createAdminClient()`) or render UI get explicit manual verification steps instead — introducing a full Postgres/RLS integration-test harness is out of scope for this feature.

---

### Task 1: Migration — `shops`, `shop_products`, `shop_products_priced`, `orders.shop_id`

**Files:**
- Create: `supabase/migrations/016_seller_shops.sql`

**Interfaces:**
- Produces: tables `public.shops` (`id, owner_id, name, slug, active, created_at, updated_at`), `public.shop_products` (`id, shop_id, product_id, markup_type, markup_value, created_at`), view `public.shop_products_priced` (`id, shop_id, product_id, markup_type, markup_value, base_price, shop_price, created_at`), and `public.orders.shop_id` (nullable). All later tasks depend on these exact names/columns.

- [ ] **Step 1: Write the migration**

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

-- Derived pricing — never stored, always current with the product's base price.
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

- [ ] **Step 2: Apply the migration**

Open your Supabase project's dashboard → SQL Editor, paste the full contents of `supabase/migrations/016_seller_shops.sql`, and run it. Expected: "Success. No rows returned."

- [ ] **Step 3: Manually verify constraints**

Run each of these in the SQL Editor (replace `<user-a>`/`<user-b>` with two real `auth.users.id` values from `select id from auth.users limit 2;`, and `<product-id>` with a real id from `select id from public.products limit 1;`):

```sql
-- Baseline insert should succeed
insert into public.shops (owner_id, name, slug) values ('<user-a>', 'Shop A', 'shop-a-test');

-- Duplicate slug must fail (unique violation, code 23505)
insert into public.shops (owner_id, name, slug) values ('<user-b>', 'Shop B', 'shop-a-test');

-- Second shop for the same owner must fail (unique violation on owner_id)
insert into public.shops (owner_id, name, slug) values ('<user-a>', 'Shop A2', 'shop-a2-test');

-- Negative markup must fail (check constraint violation)
insert into public.shop_products (shop_id, product_id, markup_type, markup_value)
  values ((select id from public.shops where slug = 'shop-a-test'), '<product-id>', 'flat', -5);

-- Valid flat markup succeeds; verify the view computes the price
insert into public.shop_products (shop_id, product_id, markup_type, markup_value)
  values ((select id from public.shops where slug = 'shop-a-test'), '<product-id>', 'flat', 10);
select * from public.shop_products_priced where shop_id = (select id from public.shops where slug = 'shop-a-test');
-- Expected: shop_price = base_price (that product's current products.price) + 10

-- Update to a percentage markup on the same row and re-check
update public.shop_products set markup_type = 'percentage', markup_value = 20
  where shop_id = (select id from public.shops where slug = 'shop-a-test') and product_id = '<product-id>';
select * from public.shop_products_priced where shop_id = (select id from public.shops where slug = 'shop-a-test');
-- Expected: shop_price = round(base_price * 1.20, 2)

-- Clean up test rows
delete from public.shops where slug in ('shop-a-test', 'shop-a2-test');
```

Expected: the two marked inserts fail with the stated error; the rest succeed and the view's `shop_price` matches `base_price + 10` for the flat case and `round(base_price * 1.20, 2)` for the percentage case.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/016_seller_shops.sql
git commit -m "feat: add shops, shop_products, and shop_products_priced schema"
```

---

### Task 2: Type system — `Shop`, `ShopProduct`, `ShopProductPriced`, `orders.shop_id`

**Files:**
- Modify: `lib/supabase/types.ts`

**Interfaces:**
- Consumes: table/view shapes from Task 1.
- Produces: `Shop`, `ShopProduct`, `ShopProductPriced` types used by every later task that touches shop data.

- [ ] **Step 1: Add table entries to the `Database['public']['Tables']` interface**

In `lib/supabase/types.ts`, inside the `Tables` object (alongside `products`, `orders`, etc.), add:

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

- [ ] **Step 2: Add `shop_id` to the existing `orders` table entry**

Find the `orders: { Row: { ... } }` block and add `shop_id: string | null` as a field (anywhere in the `Row` object, e.g. right after `paystack_reference: string | null`).

- [ ] **Step 3: Add convenience types**

At the bottom of the file, alongside the other `export type X = Database[...]['Row']` lines, add:

```ts
export type Shop = Database['public']['Tables']['shops']['Row']
export type ShopProduct = Database['public']['Tables']['shop_products']['Row']

// Shape of a row read from the shop_products_priced view, joined with its product
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

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new type errors (pre-existing errors, if any, are unrelated — but there should be none in a healthy repo).

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: add Shop, ShopProduct, ShopProductPriced types"
```

---

### Task 3: Test infrastructure (Vitest) + pure `computeShopPrice` helper

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/shop-pricing.ts`
- Create: `lib/shop-pricing.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `computeShopPrice(basePrice: number, markupType: 'flat' | 'percentage', markupValue: number): number` — used by `components/seller/MarkupForm.tsx` (Task 11) for live price preview. This is a client-side preview helper only; the DB view (`shop_products_priced`) is always the authoritative price, never this function's output.
- Produces: `npm test` command, used by every subsequent task with automated tests.

- [ ] **Step 1: Install Vitest and jsdom**

```bash
npm install -D vitest jsdom
```

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Create the Vitest config**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 4: Write the failing test**

```ts
// lib/shop-pricing.test.ts
import { describe, it, expect } from 'vitest'
import { computeShopPrice } from './shop-pricing'

describe('computeShopPrice', () => {
  it('adds a flat markup to the base price', () => {
    expect(computeShopPrice(50, 'flat', 10)).toBe(60)
  })

  it('applies a percentage markup to the base price', () => {
    expect(computeShopPrice(50, 'percentage', 20)).toBe(60)
  })

  it('rounds to 2 decimal places', () => {
    expect(computeShopPrice(19.99, 'percentage', 15)).toBe(22.99)
  })

  it('returns the base price when markup is zero', () => {
    expect(computeShopPrice(50, 'flat', 0)).toBe(50)
    expect(computeShopPrice(50, 'percentage', 0)).toBe(50)
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run lib/shop-pricing.test.ts`
Expected: FAIL — `Cannot find module './shop-pricing'` (file doesn't exist yet).

- [ ] **Step 6: Write the implementation**

```ts
// lib/shop-pricing.ts
export function computeShopPrice(
  basePrice: number,
  markupType: 'flat' | 'percentage',
  markupValue: number
): number {
  const raw = markupType === 'flat'
    ? basePrice + markupValue
    : basePrice * (1 + markupValue / 100)
  return Math.round(raw * 100) / 100
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run lib/shop-pricing.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts lib/shop-pricing.ts lib/shop-pricing.test.ts package.json package-lock.json
git commit -m "test: add Vitest and computeShopPrice pricing helper"
```

---

### Task 4: `requireShopOwner()` auth guard

**Files:**
- Create: `lib/auth/require-shop-owner.ts`
- Create: `lib/auth/require-shop-owner.test.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`, `createAdminClient` from `@/lib/supabase/admin` (both existing, unchanged).
- Produces: `requireShopOwner(): Promise<{ userId: string; shopId: string }>` — throws `Error('Unauthorized')` if not logged in, throws `Error('Forbidden: no shop found for this user')` if the user has no shop. Called at the top of every mutating function in `lib/actions/shop-products.ts` (Task 6).

- [ ] **Step 1: Write the failing test**

```ts
// lib/auth/require-shop-owner.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireShopOwner } from './require-shop-owner'

const mockGetUser = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  }),
}))

describe('requireShopOwner', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    mockSingle.mockReset()
  })

  it('throws when no user is authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(requireShopOwner()).rejects.toThrow('Unauthorized')
  })

  it('throws when the user has no shop', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: null })
    await expect(requireShopOwner()).rejects.toThrow('Forbidden: no shop found for this user')
  })

  it('returns userId and shopId for a valid shop owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: { id: 'shop-1' } })
    const result = await requireShopOwner()
    expect(result).toEqual({ userId: 'user-1', shopId: 'shop-1' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth/require-shop-owner.test.ts`
Expected: FAIL — `Cannot find module './require-shop-owner'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/auth/require-shop-owner.ts
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Authorization guard for privileged seller server code. Mirrors requireAdmin()
 * (lib/auth/require-admin.ts): call at the TOP of every mutating seller Server
 * Action. Throws on failure; returns the owner's user id and shop id on success.
 */
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/auth/require-shop-owner.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/require-shop-owner.ts lib/auth/require-shop-owner.test.ts
git commit -m "feat: add requireShopOwner auth guard"
```

---

### Task 5: `lib/actions/shops.ts` — create/read a shop

**Files:**
- Create: `lib/actions/shops.ts`
- Create: `lib/actions/shops.test.ts`

**Interfaces:**
- Consumes: `createClient`, `createAdminClient`, `Shop` type (Task 2).
- Produces: `ShopSchema` (exported Zod schema), `getMyShop(): Promise<Shop | null>`, `checkSlugAvailable(slug: string): Promise<boolean>`, `createShop(formData: FormData): Promise<{ error?: string }>`. Used by `app/seller/onboarding/page.tsx` and `components/seller/ShopOnboardingForm.tsx` (Task 9), and by `app/seller/(shop)/layout.tsx` / `app/seller/page.tsx` (Task 8).

- [ ] **Step 1: Write the failing schema test**

```ts
// lib/actions/shops.test.ts
import { describe, it, expect } from 'vitest'
import { ShopSchema } from './shops'

describe('ShopSchema', () => {
  it('accepts a valid name and slug', () => {
    const result = ShopSchema.safeParse({ name: 'Ama Fashions', slug: 'ama-fashions' })
    expect(result.success).toBe(true)
  })

  it('rejects a slug with uppercase letters', () => {
    const result = ShopSchema.safeParse({ name: 'Ama Fashions', slug: 'Ama-Fashions' })
    expect(result.success).toBe(false)
  })

  it('rejects a slug that is too short', () => {
    const result = ShopSchema.safeParse({ name: 'Ama Fashions', slug: 'ab' })
    expect(result.success).toBe(false)
  })

  it('rejects a slug with invalid characters', () => {
    const result = ShopSchema.safeParse({ name: 'Ama Fashions', slug: 'ama_fashions!' })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/actions/shops.test.ts`
Expected: FAIL — `Cannot find module './shops'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/actions/shops.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { Shop } from '@/lib/supabase/types'

export const ShopSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/, 'Slug must be 3-40 lowercase letters, numbers, or hyphens'),
})

export async function getMyShop(): Promise<Shop | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data } = await admin.from('shops').select('*').eq('owner_id', user.id).single()
  return data ?? null
}

export async function checkSlugAvailable(slug: string): Promise<boolean> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return false
  const admin = createAdminClient()
  const { data } = await admin.from('shops').select('id').eq('slug', slug).maybeSingle()
  return !data
}

export async function createShop(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to open a shop.' }

  const existing = await getMyShop()
  if (existing) return { error: 'You already have a shop.' }

  const raw = Object.fromEntries(formData)
  const parsed = ShopSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid shop details.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('shops').insert({
    owner_id: user.id,
    name: parsed.data.name,
    slug: parsed.data.slug,
    active: true,
  })

  if (error) {
    if (error.code === '23505') return { error: 'That shop URL is already taken. Please choose another.' }
    return { error: error.message }
  }

  revalidatePath('/seller')
  redirect('/seller/dashboard')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/actions/shops.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Manually verify against a live database**

This requires Task 1's migration applied and a logged-in dev session (Task 8 must exist to reach `/seller/onboarding` through the browser — if Task 8 isn't done yet, verify via a temporary script instead):

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
admin.from('shops').select('*').then(r => console.log(r));
"
```

Expected: an empty array (no shops yet) with no error — confirms the client can reach the new table. Full end-to-end verification of `createShop` happens in Task 9 once the onboarding UI exists.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/shops.ts lib/actions/shops.test.ts
git commit -m "feat: add shop creation and lookup server actions"
```

---

### Task 6: `lib/actions/shop-products.ts` — curate products into a shop

**Files:**
- Create: `lib/actions/shop-products.ts`

**Interfaces:**
- Consumes: `requireShopOwner()` (Task 4), `createAdminClient`, `ShopProductPriced`/`Product` types (Task 2).
- Produces: `addShopProducts(input: { productIds: string[]; markupType: 'flat' | 'percentage'; markupValue: number }): Promise<{ error?: string }>`, `updateShopProductMarkup(shopProductId: string, markupType: 'flat' | 'percentage', markupValue: number): Promise<{ error?: string }>`, `removeShopProduct(shopProductId: string): Promise<{ error?: string }>`, `getShopProductsPriced(shopId: string): Promise<ShopProductPriced[]>`. Used by `components/seller/ShopProductPicker.tsx` (Task 12), `components/seller/ShopProductsTable.tsx` (Task 13), and `app/seller/(shop)/products/page.tsx` (Task 13).

- [ ] **Step 1: Write the implementation**

```ts
// lib/actions/shop-products.ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireShopOwner } from '@/lib/auth/require-shop-owner'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ShopProductPriced, Product } from '@/lib/supabase/types'

const MarkupSchema = z.object({
  markupType: z.enum(['flat', 'percentage']),
  markupValue: z.coerce.number().min(0),
})

export async function addShopProducts(input: {
  productIds: string[]
  markupType: 'flat' | 'percentage'
  markupValue: number
}): Promise<{ error?: string }> {
  const { shopId } = await requireShopOwner()

  const parsed = MarkupSchema.safeParse({ markupType: input.markupType, markupValue: input.markupValue })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid markup.' }
  if (input.productIds.length === 0) return { error: 'Select at least one product.' }

  const admin = createAdminClient()
  const rows = input.productIds.map((productId) => ({
    shop_id: shopId,
    product_id: productId,
    markup_type: parsed.data.markupType,
    markup_value: parsed.data.markupValue,
  }))

  const { error } = await admin
    .from('shop_products')
    .upsert(rows, { onConflict: 'shop_id,product_id' })

  if (error) return { error: error.message }

  revalidatePath('/seller/products')
  return {}
}

export async function updateShopProductMarkup(
  shopProductId: string,
  markupType: 'flat' | 'percentage',
  markupValue: number
): Promise<{ error?: string }> {
  const { shopId } = await requireShopOwner()

  const parsed = MarkupSchema.safeParse({ markupType, markupValue })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid markup.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('shop_products')
    .update({ markup_type: parsed.data.markupType, markup_value: parsed.data.markupValue })
    .eq('id', shopProductId)
    .eq('shop_id', shopId)

  if (error) return { error: error.message }

  revalidatePath('/seller/products')
  return {}
}

export async function removeShopProduct(shopProductId: string): Promise<{ error?: string }> {
  const { shopId } = await requireShopOwner()

  const admin = createAdminClient()
  const { error } = await admin
    .from('shop_products')
    .delete()
    .eq('id', shopProductId)
    .eq('shop_id', shopId)

  if (error) return { error: error.message }

  revalidatePath('/seller/products')
  return {}
}

export async function getShopProductsPriced(shopId: string): Promise<ShopProductPriced[]> {
  const admin = createAdminClient()
  const { data: priced } = await admin
    .from('shop_products_priced')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })

  if (!priced || priced.length === 0) return []

  const productIds = priced.map((p) => p.product_id)
  const { data: products } = await admin
    .from('products')
    .select('*')
    .in('id', productIds)

  const productMap = new Map((products ?? []).map((p: Product) => [p.id, p]))

  return priced
    .map((p) => {
      const product = productMap.get(p.product_id)
      if (!product) return null
      return { ...p, product } as ShopProductPriced
    })
    .filter((p): p is ShopProductPriced => p !== null)
}
```

Note: `.eq('id', shopProductId).eq('shop_id', shopId)` on the update/delete queries is deliberate defense-in-depth — `createAdminClient()` bypasses RLS, so this explicit ownership check (not just `requireShopOwner()`) is what actually prevents a seller from mutating another shop's row by guessing/reusing an id, mirroring how every `requireAdmin()`-gated action independently re-checks scope rather than trusting the guard alone.

- [ ] **Step 2: Manually verify against a live database** (repeat after Task 1's migration is applied and at least one product exists)

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: shop } = await admin.from('shops').select('id').limit(1).single();
  const { data: products } = await admin.from('products').select('id, price').limit(2);
  // Bulk upsert — mirrors what addShopProducts does when applying one markup to multiple selected products at once
  const { error } = await admin.from('shop_products').upsert(
    products.map((p) => ({ shop_id: shop.id, product_id: p.id, markup_type: 'percentage', markup_value: 25 })),
    { onConflict: 'shop_id,product_id' }
  );
  console.log('bulk upsert error:', error);
  const { data: priced } = await admin.from('shop_products_priced').select('*').eq('shop_id', shop.id);
  console.log('priced rows (expect one per product, both with the 25% markup applied):', priced);
  products.forEach((p) => console.log('expected shop_price for', p.id, ':', Math.round(p.price * 1.25 * 100) / 100));
})();
"
```

Expected: `bulk upsert error: null`, and every logged `priced` row's `shop_price` matches its product's expected computed value — confirming one bulk call correctly prices multiple products at once. (Requires a `shops` row to already exist — create one manually via the SQL Editor if Task 9's onboarding UI isn't built yet: `insert into public.shops (owner_id, name, slug) values ('<any-user-id>', 'Test Shop', 'test-shop');`.)

- [ ] **Step 3: Commit**

```bash
git add lib/actions/shop-products.ts
git commit -m "feat: add shop product curation and pricing server actions"
```

---

### Task 7: Cart shop-scoping (`lib/cart.ts`, `AddToCartButton`, `ProductVariantSection`)

**Files:**
- Modify: `lib/cart.ts`
- Modify: `components/store/AddToCartButton.tsx`
- Modify: `components/store/ProductVariantSection.tsx`
- Create: `lib/cart.test.ts`

**Interfaces:**
- Produces: `useCart().shopId: string | null`, `useCart().shopSlug: string | null`; `addItem` gains a 5th optional param `shopContext?: { shopId: string; shopSlug: string }`. Used by `components/store/ShopProductCard.tsx` (Task 14) and the shop-scoped product detail page (Task 15) via the two modified components below.

- [ ] **Step 1: Write the failing test**

```ts
// lib/cart.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useCart } from './cart'
import type { Product } from './supabase/types'

const baseProduct: Product = {
  id: 'prod-1',
  name: 'Test Product',
  slug: 'test-product',
  description: null,
  category_id: 'cat-1',
  price: 100,
  compare_at_price: null,
  stock_qty: 10,
  images: ['img.jpg'],
  videos: [],
  status: 'active',
  preorder_days: null,
  preorder_note: null,
  featured: false,
  brand_id: null,
  attributes: {},
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('useCart shop scoping', () => {
  beforeEach(() => {
    useCart.getState().clearCart()
  })

  it('starts with no shop context', () => {
    expect(useCart.getState().shopId).toBeNull()
    expect(useCart.getState().shopSlug).toBeNull()
  })

  it('sets shop context when the first item added is from a shop', () => {
    useCart.getState().addItem(
      { ...baseProduct, price: 60 }, 1, undefined, undefined,
      { shopId: 'shop-1', shopSlug: 'my-shop' }
    )
    expect(useCart.getState().shopId).toBe('shop-1')
    expect(useCart.getState().shopSlug).toBe('my-shop')
    expect(useCart.getState().items[0].price).toBe(60)
  })

  it('rejects adding a main-site item when the cart already has shop items', () => {
    useCart.getState().addItem(
      { ...baseProduct, price: 60 }, 1, undefined, undefined,
      { shopId: 'shop-1', shopSlug: 'my-shop' }
    )
    const result = useCart.getState().addItem({ ...baseProduct, id: 'prod-2' })
    expect(result.error).toBeDefined()
    expect(useCart.getState().items).toHaveLength(1)
  })

  it('rejects adding an item from a different shop', () => {
    useCart.getState().addItem(baseProduct, 1, undefined, undefined, { shopId: 'shop-1', shopSlug: 'my-shop' })
    const result = useCart.getState().addItem(
      { ...baseProduct, id: 'prod-2' }, 1, undefined, undefined,
      { shopId: 'shop-2', shopSlug: 'other-shop' }
    )
    expect(result.error).toBeDefined()
  })

  it('resets shop context once the cart is emptied via removeItem', () => {
    useCart.getState().addItem(baseProduct, 1, undefined, undefined, { shopId: 'shop-1', shopSlug: 'my-shop' })
    useCart.getState().removeItem('prod-1')
    expect(useCart.getState().shopId).toBeNull()
    expect(useCart.getState().shopSlug).toBeNull()
  })

  it('allows a main-site item after clearCart resets shop context', () => {
    useCart.getState().addItem(baseProduct, 1, undefined, undefined, { shopId: 'shop-1', shopSlug: 'my-shop' })
    useCart.getState().clearCart()
    const result = useCart.getState().addItem({ ...baseProduct, id: 'prod-2' })
    expect(result.error).toBeUndefined()
    expect(useCart.getState().shopId).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/cart.test.ts`
Expected: FAIL — `shopId`/`shopSlug` are `undefined`, not `null`, and the mixing-guard tests fail since the 5th param doesn't exist yet.

- [ ] **Step 3: Modify `lib/cart.ts`**

Add `shopId: string | null` and `shopSlug: string | null` to the `CartStore` interface, add a 5th param to `addItem`'s signature, and update the implementation:

```ts
interface CartStore {
  items: CartItem[]
  total: number
  count: number
  hasPreorderItems: boolean
  shopId: string | null
  shopSlug: string | null
  _hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  addItem: (
    product: Product,
    qty?: number,
    selectedColor?: { name: string; hex: string },
    selectedSize?: string,
    shopContext?: { shopId: string; shopSlug: string },
  ) => { error?: string }
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  clearCart: () => void
}
```

In the store body, add `shopId: null, shopSlug: null,` next to the other initial state fields (alongside `hasPreorderItems: false,`).

Update `addItem`:

```ts
addItem(product, qty = 1, selectedColor, selectedSize, shopContext) {
  const state = get()
  const isPreorder = product.status === 'pre_order'

  // Block mixing pre-order and regular items
  if (state.items.length > 0) {
    const cartHasPreorder = state.hasPreorderItems
    if (isPreorder && !cartHasPreorder) {
      return { error: 'Pre-order items must be ordered separately. Please clear your cart first or complete your current order.' }
    }
    if (!isPreorder && cartHasPreorder) {
      return { error: 'Regular items cannot be mixed with pre-order items. Please clear your cart first or complete your pre-order.' }
    }
  }

  // Block mixing items from a different shop (or shop + main site) in one cart
  if (state.items.length > 0) {
    const newShopId = shopContext?.shopId ?? null
    if (state.shopId !== newShopId) {
      return { error: 'Your cart has items from another store. Clear your cart or finish checkout first.' }
    }
  }

  // Composite ID keeps different variants as separate cart lines
  const variantId = (selectedColor || selectedSize)
    ? `${product.id}__${selectedColor?.name ?? ''}__${selectedSize ?? ''}`
    : product.id

  const existing = state.items.find((i) => i.id === variantId)
  let items: CartItem[]
  if (existing) {
    const newQty = isPreorder
      ? existing.quantity + qty
      : Math.min(existing.quantity + qty, product.stock_qty)
    items = state.items.map((i) =>
      i.id === variantId ? { ...i, quantity: newQty } : i
    )
  } else {
    items = [
      ...state.items,
      {
        id: variantId,
        product_id: product.id,
        name: product.name,
        price: product.price,
        image: product.images[0] ?? '',
        quantity: isPreorder ? qty : Math.min(qty, product.stock_qty),
        stock_qty: product.stock_qty,
        is_preorder: isPreorder,
        preorder_days: product.preorder_days ?? null,
        preorder_note: product.preorder_note ?? null,
        selected_color: selectedColor,
        selected_size: selectedSize,
      },
    ]
  }
  set({
    items,
    shopId: shopContext?.shopId ?? state.shopId,
    shopSlug: shopContext?.shopSlug ?? state.shopSlug,
    ...deriveCart(items),
  })
  return {}
},
```

Update `removeItem` to reset shop context once the cart empties:

```ts
removeItem(id) {
  const items = get().items.filter((i) => i.id !== id)
  const shopReset = items.length === 0 ? { shopId: null, shopSlug: null } : {}
  set({ items, ...shopReset, ...deriveCart(items) })
},
```

Update `clearCart` to reset shop context:

```ts
clearCart() {
  set({ items: [], shopId: null, shopSlug: null, total: 0, count: 0, hasPreorderItems: false })
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/cart.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Modify `components/store/AddToCartButton.tsx`**

Add three optional props and forward them:

```ts
export default function AddToCartButton({
  product,
  disabled,
  selectionHint,
  salePrice,
  selectedColor,
  selectedSize,
  shopId,
  shopSlug,
  shopPrice,
}: {
  product: Product
  disabled?: boolean
  selectionHint?: string
  salePrice?: number
  selectedColor?: { name: string; hex: string }
  selectedSize?: string
  shopId?: string
  shopSlug?: string
  shopPrice?: number
}) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const [cartError, setCartError] = useState('')
  const isPreorder = product.status === 'pre_order'

  function handleAdd() {
    const overridePrice = shopPrice ?? (salePrice !== undefined && salePrice < product.price ? salePrice : undefined)
    const itemToAdd = overridePrice !== undefined ? { ...product, price: overridePrice } : product
    const shopContext = shopId && shopSlug ? { shopId, shopSlug } : undefined
    const result = addItem(itemToAdd, 1, selectedColor, selectedSize, shopContext)
    if (result?.error) {
      setCartError(result.error)
      setTimeout(() => setCartError(''), 5000)
      return
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  // ...rest of the component is unchanged
```

- [ ] **Step 6: Modify `components/store/ProductVariantSection.tsx`**

Add the same three optional props and forward them to `AddToCartButton`:

```ts
interface Props {
  product: Product
  salePrice?: number
  disabled?: boolean
  variantColors: ProductVariantColor[]
  variantSizes: string[]
  shopId?: string
  shopSlug?: string
  shopPrice?: number
}

export default function ProductVariantSection({
  product,
  salePrice,
  disabled,
  variantColors,
  variantSizes,
  shopId,
  shopSlug,
  shopPrice,
}: Props) {
  const [selectedColor, setSelectedColor] = useState<ProductVariantColor | null>(null)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)

  const needsColor = variantColors.length > 0 && !selectedColor
  const needsSize = variantSizes.length > 0 && !selectedSize
  const variantBlocked = needsColor || needsSize

  let hint = ''
  if (needsColor && needsSize) hint = 'Select a color and size to continue'
  else if (needsColor) hint = 'Select a color to continue'
  else if (needsSize) hint = 'Select a size to continue'

  return (
    <>
      <ProductVariantPicker
        colors={variantColors}
        sizes={variantSizes}
        selectedColor={selectedColor}
        selectedSize={selectedSize}
        onColorChange={setSelectedColor}
        onSizeChange={setSelectedSize}
      />
      <AddToCartButton
        product={product}
        disabled={disabled}
        selectionHint={!disabled && variantBlocked ? hint : undefined}
        salePrice={salePrice}
        selectedColor={selectedColor ?? undefined}
        selectedSize={selectedSize ?? undefined}
        shopId={shopId}
        shopSlug={shopSlug}
        shopPrice={shopPrice}
      />
    </>
  )
}
```

- [ ] **Step 7: Run the full test suite and lint**

Run: `npx vitest run && npm run lint`
Expected: all tests PASS, no new lint errors.

- [ ] **Step 8: Commit**

```bash
git add lib/cart.ts lib/cart.test.ts components/store/AddToCartButton.tsx components/store/ProductVariantSection.tsx
git commit -m "feat: add shop-scoped cart locking and price override"
```

---

### Task 8: `/seller` routing shell — `proxy.ts`, layout, sidebar, index redirect

**Files:**
- Modify: `proxy.ts`
- Create: `app/seller/page.tsx`
- Create: `app/seller/(shop)/layout.tsx`
- Create: `components/seller/SellerSidebar.tsx`

**Interfaces:**
- Consumes: `getMyShop()` (Task 5).
- Produces: the `/seller/(shop)` layout wrapper that Tasks 10 and 13's pages render inside.

- [ ] **Step 1: Modify `proxy.ts`**

Add a `/seller` auth-redirect branch (mirrors the existing `/admin` branch) and extend the matcher:

```ts
// Redirect unauthenticated users away from /admin — role enforcement is in admin/layout.tsx
if (request.nextUrl.pathname.startsWith('/admin')) {
  if (!user) {
    return NextResponse.redirect(new URL('/account/login?redirect=/admin', request.url))
  }
}

// Redirect unauthenticated users away from /seller — shop-ownership enforcement is in seller/(shop)/layout.tsx
if (request.nextUrl.pathname.startsWith('/seller')) {
  if (!user) {
    return NextResponse.redirect(new URL('/account/login?redirect=/seller', request.url))
  }
}
```

Update the `config.matcher` array:

```ts
export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/seller/:path*'],
}
```

- [ ] **Step 2: Create `app/seller/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getMyShop } from '@/lib/actions/shops'

export default async function SellerIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/account/login?redirect=/seller')

  const shop = await getMyShop()
  redirect(shop ? '/seller/dashboard' : '/seller/onboarding')
}
```

- [ ] **Step 3: Create `components/seller/SellerSidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Package, LogOut, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/seller/products', label: 'Products', icon: Package },
]

export default function SellerSidebar({ shopName, shopSlug }: { shopName: string; shopSlug: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/account/login')
  }

  return (
    <aside className="hidden lg:flex w-60 bg-gray-950 text-gray-400 flex-col shrink-0">
      <div className="px-5 py-5 border-b border-gray-800 shrink-0">
        <span className="text-white font-extrabold text-xl">
          <span className="text-green-500">Telo</span>Mall
        </span>
        <p className="text-gray-600 text-xs mt-0.5">{shopName}</p>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-green-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
              </div>
            </Link>
          )
        })}
      </nav>

      <div className="p-3 space-y-1 border-t border-gray-800 shrink-0">
        <Link href={`/shop/${shopSlug}`} target="_blank">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-800 hover:text-white transition-colors">
            <ExternalLink size={16} />
            View My Shop
          </div>
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-red-500/10 hover:text-red-400 w-full transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Create `app/seller/(shop)/layout.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import SellerSidebar from '@/components/seller/SellerSidebar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: { template: '%s | Seller', default: 'Seller' } }

export default async function SellerShopLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/account/login?redirect=/seller')

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('*').eq('owner_id', user.id).single()
  if (!shop) redirect('/seller/onboarding')

  return (
    <div className="flex h-screen bg-gray-100">
      <SellerSidebar shopName={shop.name} shopSlug={shop.slug} />
      <main className="flex-1 min-w-0 overflow-auto p-4 lg:p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 5: Manually verify routing**

Run: `npm run dev`, then in a browser:
1. Visit `/seller` while logged out — expect a redirect to `/account/login?redirect=/seller`.
2. Log in, visit `/seller` — expect a redirect to `/seller/onboarding` (no shop yet; the page itself 404s until Task 9 exists, but the redirect chain up to that point should work).

- [ ] **Step 6: Commit**

```bash
git add proxy.ts app/seller/page.tsx "app/seller/(shop)/layout.tsx" components/seller/SellerSidebar.tsx
git commit -m "feat: add /seller routing shell, layout, and sidebar"
```

---

### Task 9: Seller onboarding — `/seller/onboarding`

**Files:**
- Create: `app/seller/onboarding/page.tsx`
- Create: `components/seller/ShopOnboardingForm.tsx`

**Interfaces:**
- Consumes: `getMyShop`, `checkSlugAvailable`, `createShop` (Task 5), `slugify` from `@/lib/utils` (existing).

- [ ] **Step 1: Create `components/seller/ShopOnboardingForm.tsx`**

```tsx
'use client'

import { useState, useEffect, useTransition } from 'react'
import { slugify } from '@/lib/utils'
import { checkSlugAvailable, createShop } from '@/lib/actions/shops'

export default function ShopOnboardingForm() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name))
  }, [name, slugTouched])

  useEffect(() => {
    if (!slug || slug.length < 3) {
      setAvailability('idle')
      return
    }
    setAvailability('checking')
    const timer = setTimeout(async () => {
      const available = await checkSlugAvailable(slug)
      setAvailability(available ? 'available' : 'taken')
    }, 400)
    return () => clearTimeout(timer)
  }, [slug])

  function handleSubmit(formData: FormData) {
    setError('')
    startTransition(async () => {
      const result = await createShop(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form action={handleSubmit} className="max-w-md space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Shop name</label>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm"
          placeholder="e.g. Ama's Fashion Store"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Shop URL</label>
        <div className="flex items-center border border-gray-300 rounded-xl px-4 py-2.5 text-sm gap-1">
          <span className="text-gray-400">/shop/</span>
          <input
            name="slug"
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true) }}
            required
            minLength={3}
            maxLength={40}
            className="flex-1 outline-none"
          />
        </div>
        {availability === 'checking' && <p className="text-xs text-gray-400 mt-1">Checking availability…</p>}
        {availability === 'available' && <p className="text-xs text-green-600 mt-1">Available</p>}
        {availability === 'taken' && <p className="text-xs text-red-600 mt-1">This URL is already taken</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || availability === 'taken' || availability === 'checking'}
        className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors"
      >
        {pending ? 'Creating your shop…' : 'Open my shop'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create `app/seller/onboarding/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getMyShop } from '@/lib/actions/shops'
import ShopOnboardingForm from '@/components/seller/ShopOnboardingForm'

export default async function SellerOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/account/login?redirect=/seller/onboarding')

  const shop = await getMyShop()
  if (shop) redirect('/seller/dashboard')

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Open your shop</h1>
      <p className="text-gray-500 text-sm mb-8">
        Pick a name and URL for your shop. You can start adding products right after.
      </p>
      <ShopOnboardingForm />
    </div>
  )
}
```

Note: this page sits at `app/seller/onboarding/` — a sibling of the `app/seller/(shop)/` route group — so it is **not** wrapped by `app/seller/(shop)/layout.tsx` (which would redirect back here, looping). This mirrors the existing `app/(store)/account/login/page.tsx` vs. `app/(store)/account/(dashboard)/layout.tsx` split in this codebase.

- [ ] **Step 3: Manually verify end-to-end**

Run: `npm run dev`, log in as a test user with no shop, visit `/seller/onboarding`:
1. Type a shop name — the slug field should auto-fill with a slugified version.
2. Confirm the availability indicator shows "Available" for a fresh slug, and "This URL is already taken" if you enter a slug from Task 1's or Task 6's leftover test data (if not cleaned up) or an existing shop's slug.
3. Submit — expect a redirect to `/seller/dashboard` (a 404 is fine until Task 10 exists; confirm the URL changed and no error was shown).
4. In the Supabase SQL Editor, run `select * from public.shops where owner_id = '<your-test-user-id>';` — expect exactly one row with the name/slug you entered.
5. Visit `/seller/onboarding` again as the same user — expect an immediate redirect to `/seller/dashboard` (already has a shop).

- [ ] **Step 4: Commit**

```bash
git add app/seller/onboarding/page.tsx components/seller/ShopOnboardingForm.tsx
git commit -m "feat: add seller onboarding flow"
```

---

### Task 10: Seller dashboard — `/seller/dashboard`

**Files:**
- Create: `app/seller/(shop)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getMyShop` (Task 5), `getShopProductsPriced` (Task 6).

- [ ] **Step 1: Create the page**

```tsx
export const dynamic = 'force-dynamic'
import { getMyShop } from '@/lib/actions/shops'
import { getShopProductsPriced } from '@/lib/actions/shop-products'
import Link from 'next/link'

export default async function SellerDashboardPage() {
  const shop = await getMyShop()
  if (!shop) return null // layout already redirects if there's no shop; this satisfies TypeScript

  const products = await getShopProductsPriced(shop.id)

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">{shop.name}</h1>
      <p className="text-sm text-gray-400 mb-6">/shop/{shop.slug}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Products in shop</p>
          <p className="text-2xl font-bold text-gray-900">{products.length}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href="/seller/products"
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          Manage Products
        </Link>
        <Link
          href={`/shop/${shop.slug}`}
          target="_blank"
          className="border border-gray-300 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors hover:border-green-600"
        >
          View My Shop
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Manually verify**

Run: `npm run dev`, log in as the test user from Task 9, visit `/seller/dashboard`. Expect the shop name, slug, and a "Products in shop" count of 0 (or however many you upserted while manually testing Task 6).

- [ ] **Step 3: Commit**

```bash
git add "app/seller/(shop)/dashboard/page.tsx"
git commit -m "feat: add seller dashboard page"
```

---

### Task 11: `MarkupForm` component

**Files:**
- Create: `components/seller/MarkupForm.tsx`

**Interfaces:**
- Consumes: `computeShopPrice` (Task 3), `formatGHS` from `@/lib/utils` (existing).
- Produces: `<MarkupForm basePrice, initialMarkupType?, initialMarkupValue?, onChange>` — a controlled draft-value control. **It never persists anything itself** — it only reports the current draft `(markupType, markupValue)` to its parent via `onChange` on every change (including on mount, to seed the parent's initial draft state). Callers decide when to act on that draft: `ShopProductPicker` (Task 12) keeps it as pending bulk-apply state; `ShopProductsTable` (Task 13) keeps it as a pending edit until its own explicit "Save" button is clicked.

- [ ] **Step 1: Create the component**

```tsx
// components/seller/MarkupForm.tsx
'use client'

import { useState, useEffect } from 'react'
import { formatGHS } from '@/lib/utils'
import { computeShopPrice } from '@/lib/shop-pricing'

interface Props {
  basePrice: number
  initialMarkupType?: 'flat' | 'percentage'
  initialMarkupValue?: number
  onChange: (markupType: 'flat' | 'percentage', markupValue: number) => void
}

export default function MarkupForm({
  basePrice,
  initialMarkupType = 'flat',
  initialMarkupValue = 0,
  onChange,
}: Props) {
  const [markupType, setMarkupType] = useState<'flat' | 'percentage'>(initialMarkupType)
  const [markupValue, setMarkupValue] = useState(initialMarkupValue)

  useEffect(() => {
    onChange(markupType, markupValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markupType, markupValue])

  const preview = computeShopPrice(basePrice, markupType, markupValue)

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs font-medium">
        <button
          type="button"
          onClick={() => setMarkupType('flat')}
          className={`px-2.5 py-1.5 ${markupType === 'flat' ? 'bg-green-600 text-white' : 'bg-white text-gray-600'}`}
        >
          GHS
        </button>
        <button
          type="button"
          onClick={() => setMarkupType('percentage')}
          className={`px-2.5 py-1.5 ${markupType === 'percentage' ? 'bg-green-600 text-white' : 'bg-white text-gray-600'}`}
        >
          %
        </button>
      </div>
      <input
        type="number"
        min={0}
        step="0.01"
        value={markupValue}
        onChange={(e) => setMarkupValue(Math.max(0, Number(e.target.value)))}
        className="w-24 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm"
      />
      <span className="text-xs text-gray-500 whitespace-nowrap">→ {formatGHS(preview)}</span>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors (this component isn't wired into any page yet, so no visual check here — that happens in Tasks 12/13).

- [ ] **Step 3: Commit**

```bash
git add components/seller/MarkupForm.tsx
git commit -m "feat: add MarkupForm shared markup input component"
```

---

### Task 12: `ShopProductPicker` — browse catalog + bulk add

**Files:**
- Create: `components/seller/ShopProductPicker.tsx`

**Interfaces:**
- Consumes: `addShopProducts` (Task 6), `MarkupForm` (Task 11), `Product` type (existing).
- Produces: `<ShopProductPicker products={Product[]} />` — rendered by `SellerProductsClient` (Task 13).

- [ ] **Step 1: Create the component**

```tsx
// components/seller/ShopProductPicker.tsx
'use client'

import { useState, useTransition } from 'react'
import { formatGHS } from '@/lib/utils'
import type { Product } from '@/lib/supabase/types'
import { addShopProducts } from '@/lib/actions/shop-products'
import MarkupForm from './MarkupForm'

export default function ShopProductPicker({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [markupType, setMarkupType] = useState<'flat' | 'percentage'>('flat')
  const [markupValue, setMarkupValue] = useState(0)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleApply() {
    setMessage('')
    const count = selected.size
    startTransition(async () => {
      const result = await addShopProducts({
        productIds: Array.from(selected),
        markupType,
        markupValue,
      })
      if (result.error) {
        setMessage(result.error)
      } else {
        setMessage(`Added ${count} product${count === 1 ? '' : 's'} to your shop.`)
        setSelected(new Set())
      }
    })
  }

  const avgBasePrice = selected.size
    ? products.filter((p) => selected.has(p.id)).reduce((s, p) => s + p.price, 0) / selected.size
    : 0

  if (products.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No more products to add — you&apos;ve curated the whole catalog.</p>
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {products.map((product) => (
          <label
            key={product.id}
            className={`relative border rounded-xl p-3 cursor-pointer transition-colors ${
              selected.has(product.id) ? 'border-green-600 bg-green-50' : 'border-gray-200'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(product.id)}
              onChange={() => toggle(product.id)}
              className="absolute top-2 right-2 w-4 h-4"
            />
            <div className="aspect-square bg-gray-50 rounded-lg mb-2 overflow-hidden">
              {product.images[0] && (
                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
              )}
            </div>
            <p className="text-xs font-medium text-gray-800 line-clamp-2">{product.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{formatGHS(product.price)}</p>
          </label>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-60 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] p-4 flex flex-wrap items-center gap-3 z-30">
          <span className="text-sm font-medium text-gray-700">{selected.size} selected</span>
          <MarkupForm
            basePrice={avgBasePrice}
            initialMarkupType={markupType}
            initialMarkupValue={markupValue}
            onChange={(type, value) => { setMarkupType(type); setMarkupValue(value) }}
          />
          <button
            onClick={handleApply}
            disabled={pending}
            className="ml-auto bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            {pending ? 'Applying…' : `Apply to ${selected.size} product${selected.size === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors. Full interactive verification happens in Task 13 once this is wired into a page.

- [ ] **Step 3: Commit**

```bash
git add components/seller/ShopProductPicker.tsx
git commit -m "feat: add ShopProductPicker bulk-add component"
```

---

### Task 13: `ShopProductsTable` + wire `/seller/products`

**Files:**
- Create: `components/seller/ShopProductsTable.tsx`
- Create: `components/seller/SellerProductsClient.tsx`
- Create: `app/seller/(shop)/products/page.tsx`

**Interfaces:**
- Consumes: `updateShopProductMarkup`, `removeShopProduct`, `getShopProductsPriced` (Task 6), `MarkupForm` (Task 11), `ShopProductPicker` (Task 12), `getMyShop` (Task 5).

- [ ] **Step 1: Create `components/seller/ShopProductsTable.tsx`**

```tsx
// components/seller/ShopProductsTable.tsx
'use client'

import { useState, useTransition } from 'react'
import { formatGHS } from '@/lib/utils'
import type { ShopProductPriced } from '@/lib/supabase/types'
import { updateShopProductMarkup, removeShopProduct } from '@/lib/actions/shop-products'
import MarkupForm from './MarkupForm'

function EditableMarkupRow({
  item,
  onSave,
  onCancel,
}: {
  item: ShopProductPriced
  onSave: (markupType: 'flat' | 'percentage', markupValue: number) => void
  onCancel: () => void
}) {
  const [markupType, setMarkupType] = useState<'flat' | 'percentage'>(item.markup_type)
  const [markupValue, setMarkupValue] = useState(item.markup_value)

  return (
    <div className="flex items-center gap-2">
      <MarkupForm
        basePrice={item.base_price}
        initialMarkupType={item.markup_type}
        initialMarkupValue={item.markup_value}
        onChange={(t, v) => { setMarkupType(t); setMarkupValue(v) }}
      />
      <button onClick={() => onSave(markupType, markupValue)} className="text-green-600 text-xs font-semibold">
        Save
      </button>
      <button onClick={onCancel} className="text-gray-400 text-xs">
        Cancel
      </button>
    </div>
  )
}

export default function ShopProductsTable({ items }: { items: ShopProductPriced[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSave(item: ShopProductPriced, markupType: 'flat' | 'percentage', markupValue: number) {
    startTransition(async () => {
      await updateShopProductMarkup(item.id, markupType, markupValue)
      setEditingId(null)
    })
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      await removeShopProduct(id)
    })
  }

  if (items.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">You haven&apos;t added any products yet.</p>
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
          <th className="py-2 pr-4">Product</th>
          <th className="py-2 pr-4">Base price</th>
          <th className="py-2 pr-4">Markup</th>
          <th className="py-2 pr-4">Your price</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="border-b border-gray-100">
            <td className="py-3 pr-4 font-medium text-gray-800">{item.product.name}</td>
            <td className="py-3 pr-4 text-gray-500">{formatGHS(item.base_price)}</td>
            <td className="py-3 pr-4">
              {editingId === item.id ? (
                <EditableMarkupRow
                  item={item}
                  onSave={(markupType, markupValue) => handleSave(item, markupType, markupValue)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <button onClick={() => setEditingId(item.id)} className="text-green-600 hover:underline">
                  {item.markup_type === 'flat' ? `+${formatGHS(item.markup_value)}` : `+${item.markup_value}%`}
                </button>
              )}
            </td>
            <td className="py-3 pr-4 font-semibold text-gray-900">{formatGHS(item.shop_price)}</td>
            <td className="py-3">
              <button
                onClick={() => handleRemove(item.id)}
                disabled={pending}
                className="text-red-500 hover:underline text-xs"
              >
                Remove
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 2: Create `components/seller/SellerProductsClient.tsx`**

```tsx
// components/seller/SellerProductsClient.tsx
'use client'

import { useState } from 'react'
import ShopProductPicker from './ShopProductPicker'
import ShopProductsTable from './ShopProductsTable'
import type { Product, ShopProductPriced } from '@/lib/supabase/types'

export default function SellerProductsClient({
  availableProducts,
  curatedItems,
}: {
  availableProducts: Product[]
  curatedItems: ShopProductPriced[]
}) {
  const [tab, setTab] = useState<'browse' | 'manage'>('manage')

  return (
    <div>
      <div className="flex gap-2 mb-5 border-b border-gray-200">
        <button
          onClick={() => setTab('manage')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'manage' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'
          }`}
        >
          My Shop ({curatedItems.length})
        </button>
        <button
          onClick={() => setTab('browse')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'browse' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'
          }`}
        >
          Browse Catalog ({availableProducts.length})
        </button>
      </div>
      {tab === 'manage' ? <ShopProductsTable items={curatedItems} /> : <ShopProductPicker products={availableProducts} />}
    </div>
  )
}
```

- [ ] **Step 3: Create `app/seller/(shop)/products/page.tsx`**

```tsx
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { getMyShop } from '@/lib/actions/shops'
import { getShopProductsPriced } from '@/lib/actions/shop-products'
import SellerProductsClient from '@/components/seller/SellerProductsClient'

export default async function SellerProductsPage() {
  const shop = await getMyShop()
  if (!shop) return null // layout already redirects if there's no shop

  const supabase = await createClient()
  const [{ data: products }, curated] = await Promise.all([
    supabase.from('products').select('*').eq('status', 'active').order('name'),
    getShopProductsPriced(shop.id),
  ])

  const curatedIds = new Set(curated.map((c) => c.product_id))
  const availableToAdd = (products ?? []).filter((p) => !curatedIds.has(p.id))

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Your Products</h1>
      <SellerProductsClient availableProducts={availableToAdd} curatedItems={curated} />
    </div>
  )
}
```

- [ ] **Step 4: Manually verify end-to-end**

Run: `npm run dev`, log in as the Task 9 test seller, visit `/seller/products`:
1. "My Shop" tab shows any products you upserted while testing Task 6, with correct base price / markup / your price.
2. Click "Browse Catalog" — confirm it shows active products **not** already in your shop.
3. Select 2-3 products via checkboxes — confirm the bulk bar appears with a live price preview.
4. Set markup to `flat` `15`, click "Apply to N products" — confirm the success message, and that those products now appear under "My Shop" with the correct computed price.
5. In "My Shop", click a markup value to edit it, change it, click "Save" — confirm "Your price" updates.
6. Click "Remove" on a row — confirm it disappears from "My Shop" and reappears under "Browse Catalog".

- [ ] **Step 5: Commit**

```bash
git add components/seller/ShopProductsTable.tsx components/seller/SellerProductsClient.tsx "app/seller/(shop)/products/page.tsx"
git commit -m "feat: wire up seller products page with browse/manage tabs"
```

---

### Task 14: Public shop storefront listing — `/shop/[slug]`

**Files:**
- Create: `components/store/ShopProductCard.tsx`
- Create: `app/(store)/shop/[slug]/page.tsx`

**Interfaces:**
- Consumes: `useCart().addItem` shop context (Task 7), `ShopProductPriced` type (Task 2).

- [ ] **Step 1: Create `components/store/ShopProductCard.tsx`**

```tsx
// components/store/ShopProductCard.tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatGHS } from '@/lib/utils'
import { useCart } from '@/lib/cart'
import type { ShopProductPriced } from '@/lib/supabase/types'

export default function ShopProductCard({
  shopId,
  shopSlug,
  item,
}: {
  shopId: string
  shopSlug: string
  item: ShopProductPriced
}) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const [cartError, setCartError] = useState('')
  const product = item.product
  const outOfStock = product.stock_qty === 0 && product.status !== 'pre_order'

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    if (outOfStock) return
    const result = addItem(
      { ...product, price: item.shop_price }, 1, undefined, undefined,
      { shopId, shopSlug }
    )
    if (result?.error) {
      setCartError(result.error)
      setTimeout(() => setCartError(''), 4000)
      return
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div className="group relative">
      <Link
        href={`/shop/${shopSlug}/${product.slug}`}
        className="block bg-white rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.14)] transition-shadow duration-300"
      >
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[#fdf6ec] to-[#faecd8]">
          {product.images[0] ? (
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">📦</div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 bg-white/75 backdrop-blur-[1.5px] flex items-center justify-center">
              <span className="text-[11px] font-semibold text-[#6b6360] bg-white px-3 py-1.5 rounded-full border border-[#ede8df] shadow-sm tracking-wide">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        <div className="px-3.5 pt-3 pb-3.5">
          <p className="text-[13px] font-medium text-[#0a0a0a] line-clamp-2 leading-[1.45] mb-2">{product.name}</p>
          <div className="flex items-baseline gap-2 mb-2.5">
            <span className="font-extrabold text-sm tracking-tight text-[#b45309]">{formatGHS(item.shop_price)}</span>
          </div>
          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className={`w-full py-2.5 rounded-xl text-[11px] font-bold tracking-wide transition-colors ${
              added
                ? 'bg-green-500 text-white'
                : outOfStock
                ? 'bg-[#f5f0e8] text-[#a89e96] cursor-not-allowed'
                : 'bg-[#b45309] hover:bg-[#92400e] text-white'
            }`}
          >
            {added ? '✓ Added!' : outOfStock ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </Link>

      {cartError && (
        <div className="absolute inset-x-0 -bottom-1 translate-y-full z-20 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-[11px] text-red-700 leading-snug shadow-lg">
          {cartError}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(store)/shop/[slug]/page.tsx`**

```tsx
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ShopProductCard from '@/components/store/ShopProductCard'
import type { Metadata } from 'next'
import type { Product } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: shop } = await supabase.from('shops').select('name').eq('slug', slug).eq('active', true).single()
  return { title: shop?.name ?? 'Shop' }
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!shop) notFound()

  const { data: priced } = await supabase
    .from('shop_products_priced')
    .select('*')
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: false })

  const productIds = (priced ?? []).map((p) => p.product_id)
  const { data: products } = productIds.length
    ? await supabase.from('products').select('*').in('id', productIds).in('status', ['active', 'pre_order'])
    : { data: [] as Product[] }

  const productMap = new Map((products ?? []).map((p) => [p.id, p]))
  const items = (priced ?? [])
    .map((p) => {
      const product = productMap.get(p.product_id)
      return product ? { ...p, product } : null
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{shop.name}</h1>
      <p className="text-sm text-gray-400 mb-6">{items.length} product{items.length === 1 ? '' : 's'}</p>

      {items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {items.map((item) => (
            <ShopProductCard key={item.id} shopId={shop.id} shopSlug={shop.slug} item={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-28 text-gray-400">
          <p className="text-4xl mb-4">🛍️</p>
          <p className="font-medium text-gray-600">This shop hasn&apos;t added any products yet.</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Manually verify**

Visit `/shop/<your-test-shop-slug>` (logged out is fine — it's public):
1. Confirm it lists the products curated in Task 13 at their computed shop price.
2. Click "Add to Cart" on one — confirm the cart icon/count updates and no error appears.
3. Visit `/products` (main site) and try to add a different product to the cart — confirm you get the "items from another store" error (Task 7's guard), since the cart is still shop-scoped.
4. Visit `/cart`, clear the cart, then confirm a main-site product can now be added without error.

- [ ] **Step 4: Commit**

```bash
git add components/store/ShopProductCard.tsx "app/(store)/shop/[slug]/page.tsx"
git commit -m "feat: add public shop storefront listing"
```

---

### Task 15: Shop-scoped product detail page — `/shop/[slug]/[productSlug]`

**Files:**
- Create: `app/(store)/shop/[slug]/[productSlug]/page.tsx`

**Interfaces:**
- Consumes: `ProductVariantSection` with `shopId`/`shopSlug`/`shopPrice` props (Task 7), `ProductImages` (existing, unchanged).

- [ ] **Step 1: Create the page**

```tsx
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatGHS } from '@/lib/utils'
import ProductImages from '@/components/store/ProductImages'
import ProductVariantSection from '@/components/store/ProductVariantSection'
import type { Metadata } from 'next'
import type { ProductAttributes } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ slug: string; productSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { productSlug } = await params
  const supabase = await createClient()
  const { data: product } = await supabase
    .from('products')
    .select('name, description')
    .eq('slug', productSlug)
    .single()
  return { title: (product as any)?.name ?? 'Product', description: (product as any)?.description ?? undefined }
}

export default async function ShopProductPage({ params }: Props) {
  const { slug, productSlug } = await params
  const supabase = await createClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!shop) notFound()

  const { data: product } = await supabase
    .from('products')
    .select('*, categories(name, slug)')
    .eq('slug', productSlug)
    .in('status', ['active', 'pre_order'])
    .single() as { data: any }

  if (!product) notFound()

  const { data: shopProduct } = await supabase
    .from('shop_products_priced')
    .select('*')
    .eq('shop_id', shop.id)
    .eq('product_id', product.id)
    .single()

  if (!shopProduct) notFound()

  const isPreorder = product.status === 'pre_order'
  const inStock = product.stock_qty > 0 || isPreorder
  const attrs = (product.attributes ?? {}) as ProductAttributes
  const variantColors = attrs.colors ?? []
  const variantSizes = attrs.sizes ?? []

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
      <div className="grid md:grid-cols-2 gap-6 md:gap-10">
        <div className="min-w-0">
          <ProductImages images={product.images} videos={product.videos ?? []} name={product.name} />
        </div>

        <div className="min-w-0">
          <p className="text-sm text-green-600 mb-1">{shop.name}</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{product.name}</h1>

          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-bold text-gray-900">{formatGHS(shopProduct.shop_price)}</span>
          </div>

          <div className="mb-6">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                inStock ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {inStock ? `In Stock (${product.stock_qty} left)` : 'Out of Stock'}
            </span>
          </div>

          {product.description && <p className="text-gray-600 text-sm mb-8">{product.description}</p>}

          <ProductVariantSection
            product={product}
            disabled={!inStock}
            shopPrice={shopProduct.shop_price}
            shopId={shop.id}
            shopSlug={shop.slug}
            variantColors={variantColors}
            variantSizes={variantSizes}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Manually verify**

Visit `/shop/<slug>/<product-slug>` for a curated product:
1. Confirm the shown price matches the shop price (not base price).
2. Click "Add to Cart" — confirm it succeeds and the cart total reflects the shop price.
3. Visit `/shop/<slug>/<some-product-slug-not-in-this-shop>` — expect a 404.

- [ ] **Step 3: Commit**

```bash
git add "app/(store)/shop/[slug]/[productSlug]/page.tsx"
git commit -m "feat: add shop-scoped product detail page"
```

---

### Task 16: Checkout integration — shop-aware pricing and attribution

**Files:**
- Modify: `app/api/checkout/route.ts`
- Modify: `components/store/CheckoutForm.tsx`

**Interfaces:**
- Consumes: `useCart().shopId` (Task 7).
- Produces: `orders.shop_id` gets populated on shop-originated orders; this is what sub-project 3 (earnings ledger) will read.

- [ ] **Step 1: Modify `app/api/checkout/route.ts`**

Add `shop_id` to `CheckoutSchema` (insert this line right after the existing `payment_type: z.literal('paystack').default('paystack'),` line):

```ts
shop_id: z.string().uuid().optional(),
```

Destructure it alongside the other fields (change the existing line):

```ts
const { email, address, items: rawItems, coupon_code, shop_id } = parsed.data
```

After the existing product-fetch block (right after the `if (productsError || !products) { ... }` check, before the `flashPrices` map is built), add shop validation and pricing lookup:

```ts
// If this order came from a shop, validate it and build a shop price map
let shopPriceMap = new Map<string, number>()
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

In the per-item loop, right after the existing `if (!product) { ... }` not-found check, add a shop-membership check:

```ts
if (shop_id && !shopPriceMap.has(product.id)) {
  return NextResponse.json({ error: `${product.name} is not available in this shop.` }, { status: 400 })
}
```

Change the price resolution line (currently `price: flashPrices.get(product.id) ?? product.price,`) to prefer the shop price when a shop is involved, skipping flash pricing entirely for shop purchases:

```ts
price: shop_id ? shopPriceMap.get(product.id)! : (flashPrices.get(product.id) ?? product.price),
```

In the order insert object, add `shop_id: shop_id ?? null,` (anywhere alongside the other fields, e.g. next to `pre_order_ship_date: latestPreorderDate,`).

- [ ] **Step 2: Modify `components/store/CheckoutForm.tsx`**

Change the `useCart()` destructure (currently `const { items, total, clearCart, hasPreorderItems, _hasHydrated } = useCart()`) to include `shopId`:

```ts
const { items, total, clearCart, hasPreorderItems, _hasHydrated, shopId } = useCart()
```

In the `fetch('/api/checkout', ...)` request body, add `shop_id` right after `payment_type: 'paystack',`:

```ts
shop_id: shopId || undefined,
```

- [ ] **Step 3: Manually verify end-to-end**

1. Clear your cart, visit `/shop/<slug>`, add a curated product, go to `/checkout`, complete a test Paystack payment (test-mode keys).
2. In the Supabase SQL Editor: `select order_number, shop_id, items from public.orders order by created_at desc limit 1;` — expect `shop_id` set to the shop's id, and `items[0].price` equal to the shop price.
3. Clear the cart, buy a product from the main `/products` catalog instead, repeat the check — expect `shop_id` to be `null` and the price to be the base (or flash-sale) price, exactly as before this change.
4. Try to add a product to the cart while it's shop-scoped from a *different* shop's storefront (or the main site) — reconfirm the Task 14 guard still fires (regression check).

- [ ] **Step 4: Run the full automated suite once more**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: all green — this is the last code change in the feature, so this is the final regression gate before Task 17's manual walkthrough.

- [ ] **Step 5: Commit**

```bash
git add app/api/checkout/route.ts components/store/CheckoutForm.tsx
git commit -m "feat: make checkout shop-aware (pricing and order attribution)"
```

---

### Task 17: Final end-to-end verification + RLS spot checks

**Files:** none (verification only)

- [ ] **Step 1: Full happy-path walkthrough**

As a fresh test user (no shop yet):
1. Visit `/seller` → redirected to `/seller/onboarding`.
2. Create a shop named "Verification Shop" with slug `verification-shop`.
3. Land on `/seller/dashboard`, click "Manage Products".
4. Browse Catalog → select 3 products → apply a 20% markup in bulk → confirm all 3 appear under "My Shop" with prices 20% above base.
5. Edit one product's markup to a flat GHS 5 → confirm its price updates to base + 5 and the other two are unaffected.
6. Remove one product → confirm it's back in "Browse Catalog" and gone from "My Shop".
7. Open `/shop/verification-shop` in a new incognito window (logged out) → confirm the 2 remaining products show at their shop prices.
8. Add one to cart, check out with Paystack test mode → confirm the order completes and, per Task 16's SQL check, `orders.shop_id` is set and the charged price matches the shop price.

- [ ] **Step 2: RLS spot check — cross-shop write attempt**

In the Supabase SQL Editor, using the `authenticated` role impersonation (or the `anon`/service-role split already used elsewhere in this repo's testing), confirm a second user cannot write to the first user's shop:

```sql
-- As a second, different authenticated user (not the shop owner), this must return 0 rows / fail:
set role authenticated;
set request.jwt.claims to '{"sub": "<second-user-id>", "role": "authenticated"}';
update public.shop_products set markup_value = 999 where shop_id = (select id from public.shops where slug = 'verification-shop');
-- Expected: 0 rows affected (RLS blocks it)
reset role;
```

- [ ] **Step 3: Regression check on existing flows**

Since `orders`, `AddToCartButton`, `ProductVariantSection`, and the checkout route were all modified:
1. On the main site (`/products`), add a regular (non-shop) product to cart and check out — confirm it still works exactly as before (no `shop_id`, correct total).
2. If any active flash sale exists, confirm a main-site flash-sale product still checks out at the sale price (unaffected by the shop-pricing branch, since `shop_id` is absent).
3. Add a product with color/size variants to the cart from the main site — confirm variant selection still works (Task 7 only added optional params, didn't change existing behavior).

- [ ] **Step 4: Clean up test data**

```sql
delete from public.orders where shop_id = (select id from public.shops where slug = 'verification-shop');
delete from public.shop_products where shop_id = (select id from public.shops where slug = 'verification-shop');
delete from public.shops where slug = 'verification-shop';
```

- [ ] **Step 5: Final commit (if any cleanup files changed)**

```bash
git status
```

If nothing is staged, this task produced no code changes — it's a verification gate confirming Tasks 1-16 work together correctly end-to-end.
