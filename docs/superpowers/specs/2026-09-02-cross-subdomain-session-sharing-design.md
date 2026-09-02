# Cross-Subdomain Session Sharing — Design

## Goal

A shopper logged in on the main domain (`telomall.com`) must stay logged in when browsing a shop's subdomain (`theirshop.telomall.com`), and vice versa. Today, none of this app's three Supabase client constructors set a cookie `Domain`, so auth cookies default to host-only scope — a session set on one host is invisible on any other host, including a subdomain of the same site. This is the hard pre-activation gate flagged when the shop-subdomain routing feature was originally built: `NEXT_PUBLIC_ROOT_DOMAIN` should not be set in production until this is fixed, because without it a logged-in shopper checking out from a shop subdomain gets silently attributed as a guest buyer (`buyer_id: null`), a permanent, unrecoverable loss of order history.

## Root Cause

Confirmed by reading all three Supabase client construction sites:

- `lib/supabase/client.ts` — `createBrowserClient(url, anonKey)`, no `cookieOptions`.
- `lib/supabase/server.ts` — `createServerClient(url, anonKey, { cookies: {...} })`, no `cookieOptions`.
- `proxy.ts` — `createServerClient(url, anonKey, { cookies: {...} })`, no `cookieOptions`.

None passes a `domain`, so `@supabase/ssr` issues cookies with no `Domain` attribute, which browsers treat as host-only (exact-hostname match required — RFC 6265). This is the entire root cause; nothing else about the auth flow needs to change.

## Approach

Add a `domain` to `cookieOptions` at all three sites, computed dynamically per-request from the incoming Host header and the `NEXT_PUBLIC_ROOT_DOMAIN` env var — never a hardcoded string, so behavior stays completely inert (host-only, today's exact behavior) on `localhost`, any Vercel preview/staging URL, and whenever `NEXT_PUBLIC_ROOT_DOMAIN` is unset.

**New pure helper**, `lib/cookie-domain.ts`:

```ts
export function getCookieDomain(host: string, rootDomain: string): string | undefined {
  if (!rootDomain) return undefined
  const hostWithoutPort = host.split(':')[0].toLowerCase()
  if (hostWithoutPort === rootDomain || hostWithoutPort.endsWith(`.${rootDomain}`)) {
    return `.${rootDomain}`
  }
  return undefined
}
```

This mirrors `lib/shop-subdomain.ts`'s `getShopSlugFromHost` in shape and rigor (lowercase normalization, port stripping, exact-or-suffix match) deliberately — same problem class (deciding host-based behavior safely), same established pattern, kept in its own file since cookie scoping is a distinct concern from URL rewriting even though the logic looks similar. Returns `.{rootDomain}` (leading dot; harmless under modern cookie parsing, kept for older-client compatibility) for the bare root domain, `www.{root}`, or any `*.{root}` subdomain — covering the exact set of hosts a `wildcard` Vercel domain configuration serves. Returns `undefined` (host-only, the current default) for anything else, including when `rootDomain` is empty.

**Three integration points**, each passing `cookieOptions: { domain: getCookieDomain(host, rootDomain) }` into its existing `createBrowserClient`/`createServerClient` call:

- `lib/supabase/client.ts`: `host` comes from `window.location.hostname` (safe — this file only ever executes client-side, already an unconditional assumption of the file).
- `lib/supabase/server.ts`: `host` comes from `(await headers()).get('host') ?? ''`, the exact pattern already used in `app/(store)/shop/[slug]/page.tsx` for the same purpose (reading the incoming Host header from a Server Component).
- `proxy.ts`: `host` comes from `request.headers.get('host') ?? ''`, already read at the top of the function for the subdomain-rewrite logic — reused, not re-fetched.

All three pass `rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? ''`, matching the existing convention everywhere else this env var is read in this codebase.

## Why Not Other Approaches

**A token-passing handoff for checkout only** (sign a short-lived token identifying the buyer, pass it via a redirect when crossing from the apex to a shop subdomain) was considered and rejected: it only fixes order attribution at checkout, leaving every other authenticated interaction on a shop subdomain — wishlist, account links, "My Shop" navigation — still silently logged-out. The underlying problem is broader than checkout, and a shared cookie domain is the standard, well-understood fix every real multi-tenant/multi-subdomain platform uses for exactly this problem.

**A full SSO/session-bridge redirect dance** was considered and rejected as significant overkill for a single first-party app where apex and subdomains are served by the exact same backend and the exact same Supabase project — there is no cross-origin trust boundary here that would justify that complexity.

## Migration

No special handling for existing sessions. A session cookie issued before this ships is host-only and will simply expire/require a normal re-login once — acceptable given zero real users currently depend on session continuity across a domain that doesn't exist in production yet.

## Testing

`lib/cookie-domain.test.ts`, pure-function unit tests mirroring `lib/shop-subdomain.test.ts`'s style:
- Bare root domain → `.{root}`
- `www.{root}` → `.{root}`
- A subdomain (`theirshop.{root}`) → `.{root}`
- An unrelated host (e.g. a Vercel preview URL, `localhost`) → `undefined`
- Empty `rootDomain` (feature off) → `undefined`
- Mixed-case host → still matches (lowercased before comparison)
- Port present (local dev) → stripped before comparison

## Global Constraints

- Every code path stays byte-for-byte inert (host-only cookies, today's exact behavior) whenever `NEXT_PUBLIC_ROOT_DOMAIN` is unset or the request host doesn't belong to it — this touches the most sensitive, highest-blast-radius code in the app (every authenticated request, site-wide), so nothing about non-subdomain behavior may change.
- No database migration.
- Any task touching a `'use server'`-adjacent or routing-critical file (`proxy.ts`, `lib/supabase/server.ts`) requires a real `npm run build`, not just `tsc --noEmit`, per this project's standing rule.
- This change must be verified with the same rigor this codebase applies to money-movement code, given its blast radius: careful review, a real build, and manual sign-in verification (log in on the apex, confirm still logged in on a shop subdomain) before `NEXT_PUBLIC_ROOT_DOMAIN` is ever set in production.
