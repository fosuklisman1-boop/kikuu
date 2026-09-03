import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getShopSlugFromHost, resolveShopSubdomainRewrite } from '@/lib/shop-subdomain'
import { getCookieDomain } from '@/lib/cookie-domain'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? ''

export async function proxy(request: NextRequest) {
  // Shop subdomain routing — inert until NEXT_PUBLIC_ROOT_DOMAIN is configured.
  // Runs first and skips Supabase entirely: shop storefronts are public.
  const host = request.headers.get('host') ?? ''
  const shopSlug = getShopSlugFromHost(host, ROOT_DOMAIN)
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
  // Exact-or-slash-boundary checks: the broad matcher above means a bare
  // startsWith would also capture /admin-guide, /accounts-payable, /sellers,
  // etc. The old narrow matcher gave this boundary for free; now it's explicit.
  const pathname = request.nextUrl.pathname
  const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/')
  const isAccountPath = pathname === '/account' || pathname.startsWith('/account/')
  const isSellerPath = pathname === '/seller' || pathname.startsWith('/seller/')
  const needsAuthCheck = isAdminPath || isAccountPath || isSellerPath
  if (!needsAuthCheck) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { domain: getCookieDomain(host, ROOT_DOMAIN) },
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
  if (isAdminPath) {
    if (!user) {
      return NextResponse.redirect(new URL('/account/login?redirect=/admin', request.url))
    }
  }

  // Redirect unauthenticated users away from /seller — shop-ownership enforcement is in seller/(shop)/layout.tsx
  if (isSellerPath) {
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
  if (isAccountPath) {
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
    // Run on every path except Next.js internals, favicon/icon, /api (never
    // rewritten or auth-gated here — keeps the proxy off the payment-critical
    // path entirely), and any path with a file extension (static assets) —
    // needed so subdomain requests to "/" and "/product-slug" are caught, not
    // just the three previously-guarded prefixes.
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|api|.*\\..*).*)',
  ],
}
