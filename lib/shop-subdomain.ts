
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
