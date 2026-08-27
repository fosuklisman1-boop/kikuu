# Shop Subdomain Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shop reachable at `yourdomain.com/shop/theirshop` becomes ALSO reachable at `theirshop.yourdomain.com` with clean internal URLs, the moment `NEXT_PUBLIC_ROOT_DOMAIN` is configured. The path-based route keeps working unchanged. Until the env var is set, every new code path is a no-op.

**Architecture:** Two pure, unit-tested functions in `lib/shop-subdomain.ts` decide (a) whether a request's Host header names a shop subdomain and (b) whether/how to rewrite the path — `proxy.ts` becomes thin wiring around them. Cart, checkout, the API, and the account/admin/seller areas are explicitly excluded from the rewrite (shared, host-agnostic infrastructure). A shop's slug becomes a literal subdomain, so it's checked against a reserved-word list at creation time. No database migration.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), Zod, Vitest — unchanged.

**Spec:** [docs/superpowers/specs/2026-08-27-shop-subdomains-design.md](../specs/2026-08-27-shop-subdomains-design.md)

## Global Constraints

- Every new code path is inert when `NEXT_PUBLIC_ROOT_DOMAIN` is unset or empty — the app must be byte-for-byte behaviorally identical to today until the env var is configured.
- `/api`, `/cart`, `/checkout`, `/orders`, `/account`, `/admin`, `/seller`, `/products` must NEVER be rewritten by the subdomain middleware, even on a shop's subdomain — these are shared, host-agnostic pages that must stay reachable exactly as they are today regardless of which host served the request.
- `lib/shop-url.ts` must contain ONLY pure, client-safe code — no `next/headers`, no server-only imports of any kind, since it's imported by a Client Component (`ShopProductCard.tsx`). The one piece of logic that needs `next/headers` is inlined directly in the single Server Component that needs it, not built as a shared helper.
- `proxy.ts`'s broadened matcher must not add Supabase client creation overhead to any path outside `/admin`, `/account`, `/seller` — the existing auth logic only runs when the path actually starts with one of those three prefixes, exactly as it does today.
- A shop's slug is validated against a reserved-word list (both client-facing live-check and server-side creation) since it becomes a literal subdomain.

---

### Task 1: `lib/shop-subdomain.ts` — pure subdomain detection and rewrite logic

**Files:**
- Create: `lib/shop-subdomain.ts`
- Create: `lib/shop-subdomain.test.ts`

**Interfaces:**
- Produces: `getShopSlugFromHost(host: string, rootDomain: string): string | null`, `resolveShopSubdomainRewrite(shopSlug: string, pathname: string): string | null`. Used by Task 2 (`proxy.ts`) and Task 5 (the shop listing page's subdomain detection).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/shop-subdomain.test.ts
import { describe, it, expect } from 'vitest'
import { getShopSlugFromHost, resolveShopSubdomainRewrite } from './shop-subdomain'

describe('getShopSlugFromHost', () => {
  it('returns the slug for a shop subdomain', () => {
    expect(getShopSlugFromHost('theirshop.kikuu.store', 'kikuu.store')).toBe('theirshop')
  })

  it('returns null for the bare root domain', () => {
    expect(getShopSlugFromHost('kikuu.store', 'kikuu.store')).toBeNull()
  })

  it('returns null for www', () => {
    expect(getShopSlugFromHost('www.kikuu.store', 'kikuu.store')).toBeNull()
  })

  it('returns null for an unrelated host', () => {
    expect(getShopSlugFromHost('example.com', 'kikuu.store')).toBeNull()
  })

  it('returns null when rootDomain is empty (feature off)', () => {
    expect(getShopSlugFromHost('theirshop.kikuu.store', '')).toBeNull()
  })

  it('strips the port before comparing', () => {
    expect(getShopSlugFromHost('theirshop.kikuu.store:3000', 'kikuu.store')).toBe('theirshop')
  })
})

describe('resolveShopSubdomainRewrite', () => {
  it('rewrites the root path to the shop listing route', () => {
    expect(resolveShopSubdomainRewrite('theirshop', '/')).toBe('/shop/theirshop')
  })

  it('rewrites a product path to the shop product route', () => {
    expect(resolveShopSubdomainRewrite('theirshop', '/some-product')).toBe('/shop/theirshop/some-product')
  })

  it.each(['/checkout', '/cart', '/api/checkout', '/account/login', '/admin', '/seller/dashboard', '/products'])(
    'passes %s through unrewritten',
    (pathname) => {
      expect(resolveShopSubdomainRewrite('theirshop', pathname)).toBeNull()
    }
  )

  it('does not false-positive on a path that merely starts with a passthrough word', () => {
    expect(resolveShopSubdomainRewrite('theirshop', '/carts-and-things')).toBe('/shop/theirshop/carts-and-things')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/shop-subdomain.test.ts`
Expected: FAIL — `Cannot find module './shop-subdomain'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/shop-subdomain.ts

// Passthrough paths are never rewritten even on a shop subdomain — they're
// shared, host-agnostic infrastructure (checkout, the API, account/admin/
// seller areas, and the main product catalog as an escape hatch back to
// marketplace-wide browsing).
const PASSTHROUGH_PREFIXES = ['/api', '/cart', '/checkout', '/orders', '/account', '/admin', '/seller', '/products']

// Given a request's Host header and the configured root domain, returns the
// shop slug if this is a shop subdomain request, or null otherwise (main
// domain, www, or no root domain configured yet — the whole feature is
// inert until NEXT_PUBLIC_ROOT_DOMAIN is set).
export function getShopSlugFromHost(host: string, rootDomain: string): string | null {
  if (!rootDomain) return null
  const hostWithoutPort = host.split(':')[0]
  const suffix = `.${rootDomain}`
  if (hostWithoutPort === rootDomain || hostWithoutPort === `www.${rootDomain}`) return null
  if (!hostWithoutPort.endsWith(suffix)) return null
  const subdomain = hostWithoutPort.slice(0, -suffix.length)
  return subdomain || null
}

// Given a shop slug (already confirmed via getShopSlugFromHost) and the
// request pathname, returns the internal path to rewrite to, or null if this
// path should pass through unrewritten.
export function resolveShopSubdomainRewrite(shopSlug: string, pathname: string): string | null {
  const isPassthrough = PASSTHROUGH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (isPassthrough) return null
  return `/shop/${shopSlug}${pathname === '/' ? '' : pathname}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/shop-subdomain.test.ts`
Expected: PASS (13 tests: 6 for `getShopSlugFromHost` + 7 for `resolveShopSubdomainRewrite`, counting the `it.each` as 7 individual cases).

- [ ] **Step 5: Commit**

```bash
git add lib/shop-subdomain.ts lib/shop-subdomain.test.ts
git commit -m "feat: add pure shop-subdomain detection and rewrite logic"
```

---

### Task 2: Wire subdomain rewriting into `proxy.ts`

**Files:**
- Modify: `proxy.ts`

**Interfaces:**
- Consumes: `getShopSlugFromHost`, `resolveShopSubdomainRewrite` (Task 1).

This is the highest-blast-radius task in this plan — `proxy.ts` runs on nearly every request site-wide after this change. Treat it with the same care as this codebase's payment-code changes: read the current file in full, make only the described changes, and verify with a real build, not just `tsc`.

- [ ] **Step 1: Read the current file**

Read `proxy.ts` in full before editing so your changes land correctly against the actual current content, not an assumed one.

- [ ] **Step 2: Replace the file content**

Replace the entire contents of `proxy.ts` with:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getShopSlugFromHost, resolveShopSubdomainRewrite } from '@/lib/shop-subdomain'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? ''

export async function proxy(request: NextRequest) {
  // Shop subdomain routing — inert until NEXT_PUBLIC_ROOT_DOMAIN is configured.
  // Runs first and skips Supabase entirely: shop storefronts are public.
  const shopSlug = getShopSlugFromHost(request.headers.get('host') ?? '', ROOT_DOMAIN)
  if (shopSlug) {
    const rewritePath = resolveShopSubdomainRewrite(shopSlug, request.nextUrl.pathname)
    if (rewritePath) {
      const url = request.nextUrl.clone()
      url.pathname = rewritePath
      return NextResponse.rewrite(url)
    }
  }

  // Everything below only matters for /admin, /account, /seller — skip the
  // Supabase client entirely for every other path now that the matcher is
  // broad (needed to catch subdomain requests above), so this doesn't add
  // overhead to /products, the homepage, etc.
  const pathname = request.nextUrl.pathname
  const needsAuthCheck =
    pathname.startsWith('/admin') || pathname.startsWith('/account') || pathname.startsWith('/seller')
  if (!needsAuthCheck) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Use getSession() — reads from cookie only, no network call, no lock contention.
  // The actual security enforcement (getUser + role check) happens in each layout.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  // Redirect unauthenticated users away from /admin — role enforcement is in admin/layout.tsx
  if (pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/account/login?redirect=/admin', request.url))
    }
  }

  // Redirect unauthenticated users away from /seller — shop-ownership enforcement is in seller/(shop)/layout.tsx
  if (pathname.startsWith('/seller')) {
    if (!user) {
      return NextResponse.redirect(new URL('/account/login?redirect=/seller', request.url))
    }
  }

  // /account/login is always public — skip auth check
  if (pathname === '/account/login') {
    if (user) {
      const redirectTo = request.nextUrl.searchParams.get('redirect') ?? '/account'
      return NextResponse.redirect(new URL(redirectTo, request.url))
    }
    return supabaseResponse
  }

  // All other /account/* routes require auth
  if (pathname.startsWith('/account')) {
    if (!user) {
      const redirectUrl = encodeURIComponent(pathname)
      return NextResponse.redirect(
        new URL(`/account/login?redirect=${redirectUrl}`, request.url)
      )
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Run on every path except Next.js internals, favicon/icon, and any
    // path with a file extension (static assets) — needed so subdomain
    // requests to "/" and "/product-slug" are caught, not just the three
    // previously-guarded prefixes.
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\..*).*)',
  ],
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Run a real production build**

Run: `npm run build`
Expected: succeeds, full route list printed, no errors. This is the file every single page depends on (via the middleware layer) — a real build is the only reliable check here.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all passing (previous count + the 13 new tests from Task 1), no regressions.

- [ ] **Step 6: Manually verify with `npm run dev` — this one you CAN check locally, no domain needed**

Run: `npm run dev`, then in a browser or via curl:
1. Visit `/admin` while logged out — confirm the existing redirect to `/account/login?redirect=/admin` still fires (proves the auth logic is untouched).
2. Visit `/products`, `/`, `/cart` — confirm they load normally (proves the broadened matcher didn't break unguarded pages).
3. Since `NEXT_PUBLIC_ROOT_DOMAIN` is unset in local dev by default, the subdomain branch will never trigger — that's expected and correct; live subdomain behavior itself needs a real domain, deferred to Task 7.

- [ ] **Step 7: Commit**

```bash
git add proxy.ts
git commit -m "feat: rewrite shop subdomain requests to the existing /shop/[slug] routes"
```

---

### Task 3: `lib/shop-url.ts` — client-safe link-building helpers

**Files:**
- Create: `lib/shop-url.ts`
- Create: `lib/shop-url.test.ts`

**Interfaces:**
- Produces: `shopUrl(slug: string): string`, `shopProductHref(shopSlug: string, productSlug: string, onSubdomain: boolean): string`. Used by Task 5 (`ShopProductCard.tsx`) and Task 6 (`SellerSidebar.tsx`, seller dashboard).

**This file must contain ONLY pure, client-safe code** — no `next/headers`, no server-only imports of any kind. It's imported by `components/store/ShopProductCard.tsx`, a Client Component.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/shop-url.test.ts
import { describe, it, expect } from 'vitest'
import { shopUrl, shopProductHref } from './shop-url'

describe('shopUrl', () => {
  it('falls back to the path-based route when NEXT_PUBLIC_ROOT_DOMAIN is unset', () => {
    expect(shopUrl('theirshop')).toBe('/shop/theirshop')
  })
})

describe('shopProductHref', () => {
  it('builds a clean relative link when on the subdomain', () => {
    expect(shopProductHref('theirshop', 'some-product', true)).toBe('/some-product')
  })

  it('builds a full path-based link when not on the subdomain', () => {
    expect(shopProductHref('theirshop', 'some-product', false)).toBe('/shop/theirshop/some-product')
  })
})
```

Note: the `shopUrl` test only covers the unset-env-var fallback, since that's this sandboxed environment's actual state and the only case reliably testable without environment manipulation — the `NEXT_PUBLIC_ROOT_DOMAIN`-set branch is covered by manual verification in Task 7 against a real domain.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/shop-url.test.ts`
Expected: FAIL — `Cannot find module './shop-url'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/shop-url.ts
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? ''

// Absolute, cross-origin link to a shop's storefront — for links rendered on
// the main domain that need to point AT a shop's subdomain (e.g. "View My
// Shop" in the seller dashboard). Falls back to the path-based route when no
// root domain is configured yet, so this is safe to use everywhere right now.
export function shopUrl(slug: string): string {
  if (!ROOT_DOMAIN) return `/shop/${slug}`
  return `https://${slug}.${ROOT_DOMAIN}`
}

// Relative link to a product WITHIN a shop's own storefront pages. Pass
// `onSubdomain: true` when rendering on the shop's own subdomain (produces
// clean `/product-slug`); `false` when rendering under the path-based
// `/shop/[slug]` route on the main domain (produces `/shop/slug/product-slug`).
export function shopProductHref(shopSlug: string, productSlug: string, onSubdomain: boolean): string {
  return onSubdomain ? `/${productSlug}` : `/shop/${shopSlug}/${productSlug}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/shop-url.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/shop-url.ts lib/shop-url.test.ts
git commit -m "feat: add client-safe shop URL link-building helpers"
```

---

### Task 4: Reserved shop slugs

**Files:**
- Modify: `lib/shop-schema.ts`
- Modify: `lib/shop-schema.test.ts`
- Modify: `lib/actions/shops.ts`

**Interfaces:**
- Produces: `RESERVED_SHOP_SLUGS` exported from `lib/shop-schema.ts`. Consumed by `lib/actions/shops.ts`'s `checkSlugAvailable`.

- [ ] **Step 1: Write the failing tests**

Read the current `lib/shop-schema.test.ts` first, then add two new `it(...)` cases inside the existing `describe('ShopSchema', ...)` block (do not remove the 4 existing cases):

```ts
  it('rejects a reserved slug', () => {
    const result = ShopSchema.safeParse({ name: 'Admin Store', slug: 'admin' })
    expect(result.success).toBe(false)
  })

  it('still accepts a non-reserved, otherwise-valid slug', () => {
    const result = ShopSchema.safeParse({ name: 'Ama Fashions', slug: 'ama-fashions' })
    expect(result.success).toBe(true)
  })
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `npx vitest run lib/shop-schema.test.ts`
Expected: 5 pass, 1 fail (`'rejects a reserved slug'` — the schema doesn't reject `'admin'` yet).

- [ ] **Step 3: Modify `lib/shop-schema.ts`**

Read the current file first (it's small), then replace its contents with:

```ts
import { z } from 'zod'

// A shop's slug becomes a literal subdomain once NEXT_PUBLIC_ROOT_DOMAIN is
// configured — these must stay unavailable so a shop can never shadow a real
// site section (admin.yourdomain.com, api.yourdomain.com, etc).
export const RESERVED_SHOP_SLUGS = new Set([
  'www', 'api', 'admin', 'seller', 'account', 'app', 'shop', 'mail', 'ftp',
  'blog', 'help', 'support', 'status', 'cdn', 'static', 'assets', 'images',
  'checkout', 'cart', 'products', 'orders', 'kikuu',
])

export const ShopSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string()
    .regex(/^[a-z0-9-]{3,40}$/, 'Slug must be 3-40 lowercase letters, numbers, or hyphens')
    .refine((slug) => !RESERVED_SHOP_SLUGS.has(slug), 'This URL is reserved. Please choose another.'),
})
```

- [ ] **Step 4: Run tests to verify they all pass**

Run: `npx vitest run lib/shop-schema.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Modify `lib/actions/shops.ts`**

Read the current file first. Change the import line from:

```ts
import { ShopSchema } from '@/lib/shop-schema'
```

to:

```ts
import { ShopSchema, RESERVED_SHOP_SLUGS } from '@/lib/shop-schema'
```

Change `checkSlugAvailable` from:

```ts
export async function checkSlugAvailable(slug: string): Promise<boolean> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return false
  const admin = createAdminClient()
  const { data } = await admin.from('shops').select('id').eq('slug', slug).maybeSingle()
  return !data
}
```

to:

```ts
export async function checkSlugAvailable(slug: string): Promise<boolean> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return false
  if (RESERVED_SHOP_SLUGS.has(slug)) return false
  const admin = createAdminClient()
  const { data } = await admin.from('shops').select('id').eq('slug', slug).maybeSingle()
  return !data
}
```

Do not touch `getMyShop` or `createShop` in this file — they're unaffected (`createShop` already validates via `ShopSchema`, which now rejects reserved slugs automatically).

- [ ] **Step 6: Verify it compiles and the full suite passes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean, all tests passing (previous count + 2 new from Step 1).

- [ ] **Step 7: Run a real production build — `lib/actions/shops.ts` is a `'use server'` file**

Run: `npm run build`
Expected: succeeds. Confirm `RESERVED_SHOP_SLUGS` (a `Set`, not a function) is imported into this file but NOT re-exported from it — only `ShopSchema`'s existing exports and this file's own `async function` exports should appear in `lib/actions/shops.ts`'s export list.

- [ ] **Step 8: Commit**

```bash
git add lib/shop-schema.ts lib/shop-schema.test.ts lib/actions/shops.ts
git commit -m "feat: reject reserved slugs since a shop slug becomes a literal subdomain"
```

---

### Task 5: Host-aware links on the shop storefront

**Files:**
- Modify: `app/(store)/shop/[slug]/page.tsx`
- Modify: `components/store/ShopProductCard.tsx`

**Interfaces:**
- Consumes: `getShopSlugFromHost` (Task 1), `shopProductHref` (Task 3).

- [ ] **Step 1: Modify `app/(store)/shop/[slug]/page.tsx`**

Read the current file first. Add to the imports:

```ts
import { headers } from 'next/headers'
import { getShopSlugFromHost } from '@/lib/shop-subdomain'
```

Inside `ShopPage`, immediately after the existing `if (!shop) notFound()` line, add:

```ts
const host = (await headers()).get('host') ?? ''
const onSubdomain = getShopSlugFromHost(host, process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? '') === shop.slug
```

Find the line `<ShopProductCard key={item.id} shopId={shop.id} shopSlug={shop.slug} item={item} />` and change it to:

```tsx
<ShopProductCard key={item.id} shopId={shop.id} shopSlug={shop.slug} item={item} onSubdomain={onSubdomain} />
```

- [ ] **Step 2: Modify `components/store/ShopProductCard.tsx`**

Read the current file first. Add to the imports:

```ts
import { shopProductHref } from '@/lib/shop-url'
```

Change the props destructuring from:

```ts
export default function ShopProductCard({
  shopId,
  shopSlug,
  item,
}: {
  shopId: string
  shopSlug: string
  item: ShopProductPriced
}) {
```

to:

```ts
export default function ShopProductCard({
  shopId,
  shopSlug,
  item,
  onSubdomain,
}: {
  shopId: string
  shopSlug: string
  item: ShopProductPriced
  onSubdomain: boolean
}) {
```

Change the `Link`'s `href` from:

```tsx
<Link
  href={`/shop/${shopSlug}/${product.slug}`}
```

to:

```tsx
<Link
  href={shopProductHref(shopSlug, product.slug, onSubdomain)}
```

Nothing else in this file changes — the cart logic (`handleAdd`, `addItem` call with `{ shopId, shopSlug }`), styling, and out-of-stock handling all stay exactly as they are.

- [ ] **Step 3: Verify it compiles and the full suite passes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean, all tests passing.

- [ ] **Step 4: Run a real production build**

Run: `npm run build`
Expected: succeeds. This is the check that would catch `lib/shop-url.ts` accidentally becoming unsafe to import from the Client Component `ShopProductCard.tsx` — if `next/headers` were ever imported into `lib/shop-url.ts`, this build would fail with a clear error naming the offending import chain.

- [ ] **Step 5: Run lint on the touched files**

Run: `npx eslint "app/(store)/shop/[slug]/page.tsx" components/store/ShopProductCard.tsx`
Expected: no new errors.

- [ ] **Step 6: Manually verify (deferred — subdomain behavior needs a real domain; the non-subdomain path can be checked locally)**

With `npm run dev` and `NEXT_PUBLIC_ROOT_DOMAIN` unset (local default): visit `/shop/<a-real-shop-slug>`, confirm product links still go to `/shop/<slug>/<product-slug>` exactly as before (proves `onSubdomain` correctly evaluates to `false` when there's no root domain configured, so behavior is unchanged). Full subdomain-path verification (clean `/product-slug` links) is deferred to Task 7, once a real domain exists.

- [ ] **Step 7: Commit**

```bash
git add "app/(store)/shop/[slug]/page.tsx" components/store/ShopProductCard.tsx
git commit -m "feat: build host-aware product links on the shop storefront"
```

---

### Task 6: Domain-aware "View My Shop" links

**Files:**
- Modify: `components/seller/SellerSidebar.tsx`
- Modify: `app/seller/(shop)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `shopUrl` (Task 3).

This is one task covering two files because both edits are the same shape (swap a hardcoded `/shop/${slug}` for `shopUrl(slug)`) — batching avoids two near-identical review passes for a small, same-shape change.

- [ ] **Step 1: Modify `components/seller/SellerSidebar.tsx`**

Read the current file first. Add to the imports:

```ts
import { shopUrl } from '@/lib/shop-url'
```

Find the line `<Link href={\`/shop/${shopSlug}\`} target="_blank" onClick={onClose}>` and change it to:

```tsx
<Link href={shopUrl(shopSlug)} target="_blank" onClick={onClose}>
```

- [ ] **Step 2: Modify `app/seller/(shop)/dashboard/page.tsx`**

Read the current file first. Add to the imports:

```ts
import { shopUrl } from '@/lib/shop-url'
```

Change the line `<p className="text-sm text-gray-400 mb-6">/shop/{shop.slug}</p>` to:

```tsx
<p className="text-sm text-gray-400 mb-6">{shopUrl(shop.slug)}</p>
```

Change the line `href={\`/shop/${shop.slug}\`}` (on the "View My Shop" `Link`) to:

```tsx
href={shopUrl(shop.slug)}
```

- [ ] **Step 3: Verify it compiles and the full suite passes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean, all tests passing.

- [ ] **Step 4: Run a real production build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Run lint on the touched files**

Run: `npx eslint components/seller/SellerSidebar.tsx "app/seller/(shop)/dashboard/page.tsx"`
Expected: no new errors.

- [ ] **Step 6: Manually verify (no domain needed for this check)**

With `npm run dev` and `NEXT_PUBLIC_ROOT_DOMAIN` unset: log in as a seller, visit `/seller/dashboard`, confirm the displayed URL text and the "View My Shop" link both still read `/shop/<slug>` (proves `shopUrl`'s fallback path is exercised correctly when no domain is configured — no visible change from before this task).

- [ ] **Step 7: Commit**

```bash
git add components/seller/SellerSidebar.tsx "app/seller/(shop)/dashboard/page.tsx"
git commit -m "feat: use domain-aware links for View My Shop"
```

---

### Task 7: Final verification once a domain is attached

**Files:** none (verification only)

- [ ] **Step 1: Prerequisite**

A human needs to: register or point a domain at this Vercel project (Project Settings → Domains — Vercel provisions SSL automatically, including for a wildcard `*.yourdomain.com` entry), then set `NEXT_PUBLIC_ROOT_DOMAIN` in the Vercel project's environment variables to that domain (e.g. `kikuu.store`) and redeploy.

- [ ] **Step 2: Full happy-path walkthrough**

1. Visit `{shop-slug}.{root-domain}` for a real shop — confirm the storefront renders (same content as `{root-domain}/shop/{shop-slug}`).
2. Click into a product from the subdomain — confirm the URL stays clean (`{shop-slug}.{root-domain}/{product-slug}`, no `/shop/` segment visible).
3. Add to cart and complete checkout starting from the subdomain — confirm it lands on the normal `/checkout` flow (not rewritten), completes normally, and the resulting order still has the correct `shop_id` attribution.
4. Confirm `{root-domain}/shop/{shop-slug}` still works completely unchanged (both URLs live simultaneously, per the design decision not to redirect).
5. As the shop's owner, visit `/seller/dashboard` — confirm the displayed URL and the "View My Shop" link both now point at the real subdomain, not the old path.

- [ ] **Step 3: Edge cases**

1. Visit a nonexistent shop's subdomain (`nonexistent.{root-domain}`) — confirm it 404s (inherited from the existing `/shop/[slug]` page's own not-found handling, no new logic needed).
2. Try to create a shop with a reserved slug (e.g. `admin`) — confirm both the live availability check and the final submission reject it.
3. Visit `www.{root-domain}` — confirm it serves the main site, not a 404 or a shop lookup for "www".

- [ ] **Step 4: Regression check**

Re-confirm the existing `/admin`, `/account`, `/seller` auth redirects still work correctly on the main domain now that the middleware matcher is broader — this was checked locally in Task 2 without a real domain, but worth one more pass now that the full deployment is live with `NEXT_PUBLIC_ROOT_DOMAIN` actually set.

- [ ] **Step 5: No commit expected** unless verification surfaces a bug, in which case fix it, verify, and commit normally.
