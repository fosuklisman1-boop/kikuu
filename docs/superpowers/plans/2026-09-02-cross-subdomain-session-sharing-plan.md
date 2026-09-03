# Cross-Subdomain Session Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shopper logged in on `telomall.com` stays logged in on any shop subdomain (`theirshop.telomall.com`) and vice versa, by scoping Supabase auth cookies to the whole domain family instead of the exact host — computed dynamically so behavior is byte-for-byte unchanged everywhere else (localhost, Vercel preview URLs, or whenever `NEXT_PUBLIC_ROOT_DOMAIN` is unset).

**Architecture:** One new pure helper, `getCookieDomain(host, rootDomain)`, mirroring the existing `getShopSlugFromHost` pattern. Three integration points — the browser Supabase client, the server Supabase client, and `proxy.ts` — each pass its computed cookie domain into `cookieOptions`. No schema change, no new UI.

**Tech Stack:** Next.js 16 App Router, `@supabase/ssr`, Vitest — unchanged.

**Spec:** [docs/superpowers/specs/2026-09-02-cross-subdomain-session-sharing-design.md](../specs/2026-09-02-cross-subdomain-session-sharing-design.md)

## Global Constraints

- Every code path stays byte-for-byte inert (host-only cookies, today's exact behavior) whenever `NEXT_PUBLIC_ROOT_DOMAIN` is unset or the request host doesn't belong to it.
- No database migration.
- Any task touching `proxy.ts` or `lib/supabase/server.ts` requires a real `npm run build`, not just `tsc --noEmit` — these are the highest-blast-radius files in the app (every authenticated request, site-wide).
- No special handling for existing sessions — an old host-only cookie simply requires one normal re-login after this ships; this is an accepted, deliberate simplification (see spec's Migration section).

---

### Task 1: `lib/cookie-domain.ts` — pure cookie-domain helper

**Files:**
- Create: `lib/cookie-domain.ts`
- Create: `lib/cookie-domain.test.ts`

**Interfaces:**
- Produces: `getCookieDomain(host: string, rootDomain: string): string | undefined`. Used by Task 2 (`lib/supabase/client.ts`, `lib/supabase/server.ts`, `proxy.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/cookie-domain.test.ts
import { describe, it, expect } from 'vitest'
import { getCookieDomain } from './cookie-domain'

describe('getCookieDomain', () => {
  it('returns the shared domain for the bare root domain', () => {
    expect(getCookieDomain('telomall.com', 'telomall.com')).toBe('.telomall.com')
  })

  it('returns the shared domain for www', () => {
    expect(getCookieDomain('www.telomall.com', 'telomall.com')).toBe('.telomall.com')
  })

  it('returns the shared domain for a shop subdomain', () => {
    expect(getCookieDomain('theirshop.telomall.com', 'telomall.com')).toBe('.telomall.com')
  })

  it('returns undefined for an unrelated host', () => {
    expect(getCookieDomain('kikuu-seven.vercel.app', 'telomall.com')).toBeUndefined()
  })

  it('returns undefined for localhost', () => {
    expect(getCookieDomain('localhost:3000', 'telomall.com')).toBeUndefined()
  })

  it('returns undefined when rootDomain is empty (feature off)', () => {
    expect(getCookieDomain('theirshop.telomall.com', '')).toBeUndefined()
  })

  it('is case-insensitive on the host', () => {
    expect(getCookieDomain('TheirShop.Telomall.com', 'telomall.com')).toBe('.telomall.com')
  })

  it('strips the port before comparing', () => {
    expect(getCookieDomain('telomall.com:3000', 'telomall.com')).toBe('.telomall.com')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/cookie-domain.test.ts`
Expected: FAIL — `Cannot find module './cookie-domain'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/cookie-domain.ts

// Given a request Host header and the configured root domain, returns the
// cookie Domain attribute that shares an auth session across the apex and
// every subdomain of it (e.g. telomall.com and theirshop.telomall.com), or
// undefined (host-only — the default, today's exact behavior) for any host
// that doesn't belong to that domain family, or when no root domain is
// configured yet — the whole feature is inert until NEXT_PUBLIC_ROOT_DOMAIN
// is set, same convention as lib/shop-subdomain.ts.
export function getCookieDomain(host: string, rootDomain: string): string | undefined {
  if (!rootDomain) return undefined
  const hostWithoutPort = host.split(':')[0].toLowerCase()
  if (hostWithoutPort === rootDomain || hostWithoutPort.endsWith(`.${rootDomain}`)) {
    return `.${rootDomain}`
  }
  return undefined
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/cookie-domain.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/cookie-domain.ts lib/cookie-domain.test.ts
git commit -m "feat: add pure cookie-domain helper for cross-subdomain session sharing"
```

---

### Task 2: Wire the cookie domain into all three Supabase client constructors

This is the highest-blast-radius task in this plan — these three files run on nearly every request, authenticated or not, site-wide. Treat it with the same care this codebase applies to payment-code changes: read each current file in full, make only the described changes, and verify with a real build and a real manual sign-in check, not just `tsc`.

**Files:**
- Modify: `lib/supabase/client.ts`
- Modify: `lib/supabase/server.ts`
- Modify: `proxy.ts`

**Interfaces:**
- Consumes: `getCookieDomain(host: string, rootDomain: string): string | undefined` (Task 1).

- [ ] **Step 1: Read all three current files in full**

Read `lib/supabase/client.ts`, `lib/supabase/server.ts`, and `proxy.ts` in full before editing, to confirm the snippets below apply cleanly against what's actually on disk.

- [ ] **Step 2: Modify `lib/supabase/client.ts`**

Replace the entire file with:

```ts
import { createBrowserClient } from '@supabase/ssr'
import { getCookieDomain } from '@/lib/cookie-domain'

export function createClient() {
  const domain = typeof window !== 'undefined'
    ? getCookieDomain(window.location.hostname, process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? '')
    : undefined

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { domain },
    }
  )
}
```

The `typeof window !== 'undefined'` guard is defensive: this file is conventionally only ever called from Client Components, but the guard means it can never throw if that convention is ever violated — it just falls back to host-only cookies.

- [ ] **Step 3: Modify `lib/supabase/server.ts`**

Replace the entire file with:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { getCookieDomain } from '@/lib/cookie-domain'

export async function createClient() {
  const cookieStore = await cookies()
  const host = (await headers()).get('host') ?? ''
  const domain = getCookieDomain(host, process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? '')

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { domain },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — middleware handles session refresh
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Modify `proxy.ts`**

Add the import, alongside the existing imports at the top of the file:

```ts
import { getCookieDomain } from '@/lib/cookie-domain'
```

Find the line (near the top of the `proxy` function):

```ts
const shopSlug = getShopSlugFromHost(request.headers.get('host') ?? '', ROOT_DOMAIN)
```

Replace it with a hoisted `host` constant, reused by both the subdomain check and the new cookie-domain computation:

```ts
const host = request.headers.get('host') ?? ''
const shopSlug = getShopSlugFromHost(host, ROOT_DOMAIN)
```

Find the `createServerClient` call further down in the same function:

```ts
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
```

Add `cookieOptions` as a new property alongside the existing `cookies` property:

```ts
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookieOptions: { domain: getCookieDomain(host, ROOT_DOMAIN) },
    cookies: {
```

Nothing else in `proxy.ts` changes — the rest of the `cookies: {...}` block (`getAll`/`setAll`), the auth-redirect logic, and the `config.matcher` export stay exactly as they are.

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Run a real production build**

Run: `npm run build`
Expected: succeeds, full route list printed, no errors. This is the only reliable check for `proxy.ts` given this exact codebase's prior incident where a build-time-only failure was invisible to `tsc`/Vitest alike.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: all passing, including the 8 new tests from Task 1, no regressions.

- [ ] **Step 8: Manually verify with `npm run dev` — the inert case (no domain configured locally)**

With `NEXT_PUBLIC_ROOT_DOMAIN` unset (the local default), log in at `/account/login`, confirm the session persists across page navigation exactly as before this change. This proves the whole feature is a no-op when the env var isn't set — the only case reliably testable without the real domain.

- [ ] **Step 9: Manually verify against the live `telomall.com` deployment — the case this task exists for**

This step requires `NEXT_PUBLIC_ROOT_DOMAIN=telomall.com` to be set in the Vercel project's environment variables and a deploy to have gone out with it set — coordinate with whoever controls the Vercel project before doing this, since setting that env var is the exact activation switch this whole plan exists to make safe.

Two checks belong *before* flipping that switch:

1. **Check the env var's value is clean.** Confirm `NEXT_PUBLIC_ROOT_DOMAIN` has no leading/trailing whitespace and is all lowercase. The code now normalizes this defensively (`.trim().toLowerCase()` in `lib/cookie-domain.ts`, `lib/shop-subdomain.ts`, and `lib/shop-url.ts`), but a clean value avoids relying on that normalization in the first place.
2. **Audit `telomall.com`'s DNS for third-party and dangling subdomains.** Look for any subdomain delegated to a third-party service (a help desk, status page, or marketing/analytics tool on a `*.telomall.com` CNAME) and any dangling/unclaimed subdomain record. Once cookie-domain sharing is active, the session cookie is readable by JavaScript on *every* subdomain (this app's Supabase cookies are not `httpOnly`, by Supabase's own default) — a third-party or attacker-controlled subdomain would gain full account-takeover-level access to any visiting user's session. **Standing rule going forward: never point a `telomall.com` subdomain at a third-party service without first confirming that this is an acceptable trust boundary.**

Once the env var is set and deployed:

3. Log in at `https://telomall.com/account/login`.
4. Open dev tools → Application/Storage → Cookies, confirm the Supabase session cookie(s) now show `Domain: .telomall.com` (not host-only).
5. Navigate to any existing shop's subdomain (e.g. `https://clings.telomall.com/`, using the one real shop in production as of this session) — confirm you're still shown as logged in (e.g. the profile sidebar shows your name, not a "Sign In" prompt).
6. Complete a test purchase from that shop subdomain while logged in, then check `/account/orders` on the apex domain — confirm the order appears there (proving `buyer_id` was correctly attributed, not left null).
7. **Repeat the login check on a browser profile that was already logged in BEFORE the activating deploy**, not only a fresh/clean profile. Confirm the pre-existing session either re-authenticates cleanly or the user is prompted to log in again — without landing in a broken state. Expect friction here: browser and server-side cookie handling resolve duplicate same-name cookies in *opposite* directions (the browser keeps the first/stale one it sees; the server reads the last/fresh one), so an already-logged-in browser can end up with the browser and the server disagreeing about which session is active, which can trip Supabase's refresh-token-reuse detection and force a full logout. This is expected and has no code-level fix — it's a one-time transition cost for any user who was logged in at the exact moment of activation.
8. **Then test sign-out on that same pre-activation profile.** Because the pre-existing session cookie is host-only (no `Domain` attribute) while sign-out deletes the new `Domain`-scoped cookie, sign-out may not fully clear the old cookie until it naturally expires (session JWTs typically expire in about an hour). This is a known, accepted limitation — not a bug to chase — but worth knowing so it isn't mistaken for a broken sign-out during verification.

- [ ] **Step 10: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts proxy.ts
git commit -m "feat: share auth session across the apex domain and shop subdomains"
```
