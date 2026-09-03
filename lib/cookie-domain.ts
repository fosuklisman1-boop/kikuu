// Given a request Host header and the configured root domain, returns the
// cookie Domain attribute that shares an auth session across the apex and
// every subdomain of it (e.g. telomall.com and theirshop.telomall.com), or
// undefined (host-only — the default, today's exact behavior) for any host
// that doesn't belong to that domain family, or when no root domain is
// configured yet — the whole feature is inert until NEXT_PUBLIC_ROOT_DOMAIN
// is set, same convention as lib/shop-subdomain.ts.
export function getCookieDomain(host: string, rootDomain: string): string | undefined {
  // Normalize the configured root domain the same way the host is normalized
  // below: a stray space or capital letter in NEXT_PUBLIC_ROOT_DOMAIN would
  // otherwise silently turn this whole feature off (DNS is case-insensitive,
  // so the subdomain would still resolve — just without a shared session).
  const root = rootDomain.trim().toLowerCase()
  if (!root) return undefined
  const hostWithoutPort = host.split(':')[0].toLowerCase()
  if (hostWithoutPort === root || hostWithoutPort.endsWith(`.${root}`)) {
    return `.${root}`
  }
  return undefined
}
