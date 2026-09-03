// Normalized the same way lib/cookie-domain.ts and lib/shop-subdomain.ts
// normalize it, so the URLs emitted here always match the hosts those two
// functions will actually recognize.
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? '').trim().toLowerCase()

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
