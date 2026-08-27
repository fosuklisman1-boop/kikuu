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
