# Shop Subdomain Routing — Design Spec

**Sub-project 2 of the seller-shops initiative** — the piece explicitly deferred earlier so Wallet & Withdrawals could ship first. Builds on sub-project 1's promise: "sub-project 2 makes a subdomain rewrite to the same route, no app-logic changes needed later." Turns `/shop/[slug]` from the only way to reach a shop into an additional way — `[slug].yourdomain.com` becomes the primary one, once a domain is attached.

## Goal

A shop reachable at `yourdomain.com/shop/theirshop` becomes ALSO reachable at `theirshop.yourdomain.com`, with clean internal URLs (`theirshop.yourdomain.com/some-product`, not `theirshop.yourdomain.com/shop/theirshop/some-product`). The path-based route keeps working unchanged (per your decision — no redirect). The whole feature is inert until a real domain is attached and configured; nothing here changes behavior for the current `kikuu-seven.vercel.app` deployment until that happens.

## Architecture

**Tech stack:** unchanged — Next.js 16, Supabase (Postgres + RLS), Zod, Vitest. **No database migration in this sub-project** — this is routing/middleware plus link-building, not a data model change.

A single env var, `NEXT_PUBLIC_ROOT_DOMAIN` (e.g. `kikuu.store`), gates everything. When unset, every new code path in this spec no-ops and the app behaves exactly as it does today. `proxy.ts` gains a new, first-checked branch: if the request's `Host` header is `{slug}.{ROOT_DOMAIN}`, the URL is rewritten internally to `/shop/{slug}{path}` — the existing `/shop/[slug]` and `/shop/[slug]/[productSlug]` routes serve the content either way, so no page/component logic needs to know it's being reached via a subdomain except where it needs to *build a link* (a link built while already on the subdomain must stay relative and clean, not repeat `/shop/{slug}`).

Two pieces of pure decision logic — "is this host a shop subdomain, and which shop" and "should this specific path be rewritten, and to what" — are extracted into a standalone module with real unit tests, following this codebase's established pattern (`computeShopPrice`, `computeOrderEarnings`) of keeping routing/pricing decisions pure and testable, with the actual middleware function reduced to thin wiring around them.

**A detail that matters and is easy to miss:** `/cart`, `/checkout`, `/api/*`, `/account/*`, `/admin/*`, `/seller/*`, and `/products` must NEVER be rewritten, even when the request arrives on a shop's subdomain. Cart and checkout are shared, host-agnostic infrastructure (a customer shopping on `theirshop.yourdomain.com` still needs to reach the *same* `/checkout` page sub-project 1 already built, not a nonexistent `/shop/theirshop/checkout`). Next.js resolves routes by path only, not by host, so these pages render identically regardless of which host served the request — they just need to be excluded from the rewrite, not redirected anywhere.

**Performance note:** `proxy.ts`'s middleware `matcher` currently only runs on `/admin`, `/account`, `/seller` — subdomain detection needs it to run on nearly every path instead. To avoid slowing down every other page load with an unconditional Supabase client creation (today's code does this for every matched request), the function is restructured so the cheap host-check happens first with no I/O, and the existing Supabase/auth logic only runs when the path actually starts with `/admin`, `/account`, or `/seller` — identical behavior to today for every page that isn't one of those three.

---

## `lib/shop-subdomain.ts` — new file, pure logic, no directive

```ts
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

## `lib/shop-subdomain.test.ts` — new file

Real Vitest coverage (no mocking needed — both functions are pure string logic):

- `getShopSlugFromHost`: returns the slug for `theirshop.kikuu.store` with root domain `kikuu.store`; returns `null` for the bare root domain; returns `null` for `www.kikuu.store`; returns `null` for an unrelated host (`example.com`); returns `null` when `rootDomain` is empty string (feature-off case); handles a host with a port (`theirshop.kikuu.store:3000`) the same as without one.
- `resolveShopSubdomainRewrite`: `/` rewrites to `/shop/theirshop`; `/some-product` rewrites to `/shop/theirshop/some-product`; `/checkout`, `/cart`, `/api/checkout`, `/account/login`, `/admin`, `/seller/dashboard`, `/products` all return `null` (passthrough); a passthrough prefix as a strict path segment doesn't false-positive on a similarly-named product slug (e.g. `/carts-and-things` is NOT treated as passthrough, only exact `/cart` or `/cart/...`).

---

## `proxy.ts` — modify (existing file)

Full replacement content:

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

Only the auth-related logic (unchanged from today) and the matcher (broadened) differ from the current file — the new subdomain block is purely additive at the top.

---

## `lib/shop-url.ts` — new file

**Deliberately contains ONLY pure, client-safe helpers — no `next/headers`, no server-only imports.** This file is imported by `components/store/ShopProductCard.tsx`, a Client Component; mixing in a server-only function here (even behind a dynamic import) risks exactly the kind of build-time ambiguity this project has already been bitten by once (a `'use server'` export-shape bug that neither `tsc` nor Vitest caught). The one piece of logic that genuinely needs `next/headers` (reading the current request's Host header) is kept out of this file entirely — see the next section, it's inlined directly in the one Server Component that needs it instead of built as a shared helper (YAGNI: there's only one call site).

```ts
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

---

## `lib/shop-schema.ts` — modify (existing file)

Add a reserved-slug list and enforce it in the schema:

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

## `lib/shop-schema.test.ts` — modify (existing file)

Add two new test cases to the existing `describe('ShopSchema', ...)` block: a reserved slug (`'admin'`) is rejected; a non-reserved, otherwise-valid slug (`'ama-fashions'`) still passes (regression check that the `.refine()` doesn't break the happy path).

## `lib/actions/shops.ts` — modify (existing file)

`checkSlugAvailable` currently only checks the regex and the DB. Add the reserved-slug check so the live-typing availability indicator on the onboarding form correctly shows "taken" for a reserved word too, not just already-registered ones:

```ts
export async function checkSlugAvailable(slug: string): Promise<boolean> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return false
  if (RESERVED_SHOP_SLUGS.has(slug)) return false
  const admin = createAdminClient()
  const { data } = await admin.from('shops').select('id').eq('slug', slug).maybeSingle()
  return !data
}
```

Add `RESERVED_SHOP_SLUGS` to the existing `import { ShopSchema } from '@/lib/shop-schema'` line (`import { ShopSchema, RESERVED_SHOP_SLUGS } from '@/lib/shop-schema'`).

---

## `app/(store)/shop/[slug]/page.tsx` — modify (existing file)

This is a Server Component, so `next/headers` is safe to import directly here — no shared helper needed for a single call site. Add to the imports:

```ts
import { headers } from 'next/headers'
import { getShopSlugFromHost } from '@/lib/shop-subdomain'
```

Inside `ShopPage`, after `if (!shop) notFound()`, add:

```ts
const host = (await headers()).get('host') ?? ''
const onSubdomain = getShopSlugFromHost(host, process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? '') === shop.slug
```

Pass it down: `<ShopProductCard key={item.id} shopId={shop.id} shopSlug={shop.slug} item={item} onSubdomain={onSubdomain} />`.

## `components/store/ShopProductCard.tsx` — modify (existing file)

Add the new prop and use it for the link:

```ts
import { shopProductHref } from '@/lib/shop-url'

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
  // ...unchanged body...
  return (
    <div className="group relative">
      <Link
        href={shopProductHref(shopSlug, product.slug, onSubdomain)}
        // ...rest unchanged...
```

Only the `Link`'s `href` line and the props signature change — everything else in the component (cart logic, styling, out-of-stock handling) stays exactly as it is.

---

## `components/seller/SellerSidebar.tsx` — modify (existing file)

The "View My Shop" link currently hardcodes `/shop/${shopSlug}`. Change to the domain-aware helper so it opens the real subdomain once one is configured:

```ts
import { shopUrl } from '@/lib/shop-url'
```

```tsx
<Link href={shopUrl(shopSlug)} target="_blank" onClick={onClose}>
```

## `app/seller/(shop)/dashboard/page.tsx` — modify (existing file)

Same change for its own "View My Shop" link, plus the display text above it (currently hardcoded `/shop/{shop.slug}`) so the dashboard shows the seller their *actual* live URL:

```ts
import { shopUrl } from '@/lib/shop-url'
```

Change `<p className="text-sm text-gray-400 mb-6">/shop/{shop.slug}</p>` to `<p className="text-sm text-gray-400 mb-6">{shopUrl(shop.slug)}</p>`, and the `Link`'s `href={\`/shop/${shop.slug}\`}` to `href={shopUrl(shop.slug)}`.

---

## Error handling & edge cases

- **`NEXT_PUBLIC_ROOT_DOMAIN` unset (today's actual state):** every function in `lib/shop-subdomain.ts` returns `null`/passes through, `shopUrl()` falls back to the existing `/shop/slug` path — the app is byte-for-byte behaviorally identical to before this sub-project shipped. Safe to deploy immediately, activates the moment the env var is set.
- **A shop subdomain for a shop that doesn't exist or is inactive:** the rewrite still fires (`/shop/{slug}`), and the existing `/shop/[slug]/page.tsx` already 404s correctly on a missing/inactive shop — no new handling needed, this is inherited for free from sub-project 1.
- **Cart/checkout while browsing a shop's subdomain:** explicitly excluded from the rewrite (passthrough list) — these pages render identically regardless of host, so a customer's checkout flow is completely unaffected by which URL they arrived from.
- **A reserved slug typed on the onboarding form:** rejected both by the live `checkSlugAvailable` check (shows "taken") and, as a backstop, by `ShopSchema`'s server-side `.refine()` in `createShop` — matches the existing double-enforcement pattern already used for the regex format check.
- **`www.{ROOT_DOMAIN}`:** explicitly excluded from subdomain detection in `getShopSlugFromHost` — treated as the main site, not a shop named "www" (which is also independently blocked by the reserved-slug list).

## Testing

- **`lib/shop-subdomain.test.ts`**: real, DB-free unit tests covering both pure functions — the full matrix described above (subdomain detection across main/www/unrelated/no-root-domain/with-port hosts; rewrite resolution across shop-content paths vs. every passthrough prefix).
- **`lib/shop-schema.test.ts`**: two new cases added to the existing suite (reserved-slug rejection, non-reserved slug still passes).
- **Integration checkpoint** (manual, deferred to a human with a real domain — this cannot be verified in any sandboxed environment regardless of Supabase/Vercel CLI access, since it requires real DNS resolution): once a domain is attached and `NEXT_PUBLIC_ROOT_DOMAIN` is set, visit `{shop-slug}.{root-domain}` and confirm the shop's storefront renders; click into a product and confirm the URL stays clean (`{slug}.{root-domain}/{product-slug}`, no `/shop/` in the address bar); add to cart and complete checkout from the subdomain and confirm it behaves identically to the path-based flow (same `/checkout`, same order attribution); confirm `{root-domain}/shop/{slug}` still independently works unchanged; confirm the seller dashboard's "View My Shop" link and displayed URL both point at the subdomain, not the old path.

## File summary

| Action | File |
|--------|------|
| Create | `lib/shop-subdomain.ts` |
| Create | `lib/shop-subdomain.test.ts` |
| Modify | `proxy.ts` |
| Create | `lib/shop-url.ts` |
| Modify | `lib/shop-schema.ts` |
| Modify | `lib/shop-schema.test.ts` |
| Modify | `lib/actions/shops.ts` |
| Modify | `app/(store)/shop/[slug]/page.tsx` |
| Modify | `components/store/ShopProductCard.tsx` |
| Modify | `components/seller/SellerSidebar.tsx` |
| Modify | `app/seller/(shop)/dashboard/page.tsx` |

## Explicitly out of scope (flagged, not built here)

- Purchasing/configuring the actual domain and its DNS — that's on you; this spec only makes the app ready to use one the moment it exists.
- SSL/TLS for the wildcard subdomain — Vercel provisions this automatically for any domain (including wildcards) added to a project, no app-level work needed.
- Redirecting `/shop/[slug]` to the subdomain — explicitly decided against; both stay live permanently.
- Per-shop custom domains (a seller bringing their own fully separate domain, not a subdomain of yours) — a different, larger feature, not requested.
