
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
  // Normalize the configured root domain too: a stray space or capital letter
  // in NEXT_PUBLIC_ROOT_DOMAIN would otherwise silently disable the rewrite
  // while DNS still serves the subdomain.
  const root = rootDomain.trim().toLowerCase()
  if (!root) return null
  // Host headers are case-insensitive; normalize once here so every caller
  // gets a lowercase slug that matches the (lowercase-only) shops.slug column.
  const hostWithoutPort = host.split(':')[0].toLowerCase()
  const suffix = `.${root}`
  if (hostWithoutPort === root || hostWithoutPort === `www.${root}`) return null
  if (!hostWithoutPort.endsWith(suffix)) return null
  const subdomain = hostWithoutPort.slice(0, -suffix.length)
  // Must look like a real shop slug (see lib/shop-schema.ts) — this also
  // rejects multi-level hosts like "shop.staging.kikuu.store" (literal dot).
  if (!/^[a-z0-9-]{3,40}$/.test(subdomain)) return null
  return subdomain
}

// Given a shop slug (already confirmed via getShopSlugFromHost) and the
// request pathname, returns the internal path to rewrite to, or null if this
// path should pass through unrewritten.
export function resolveShopSubdomainRewrite(shopSlug: string, pathname: string): string | null {
  const isPassthrough = PASSTHROUGH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (isPassthrough) return null
  return `/shop/${shopSlug}${pathname === '/' ? '' : pathname}`
}
