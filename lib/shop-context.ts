import { headers } from 'next/headers'
import { getShopSlugFromHost, SHOP_SLUG_HEADER } from '@/lib/shop-subdomain'

export interface ShopContext {
  slug: string
  /** Path prefix for shop-internal links: '' on the shop's subdomain, '/shop/<slug>' on the path-based fallback. */
  base: string
  /** Where "home" is for this shop. */
  home: string
}

// Server-only. Returns the shop this request is scoped to, or null on the
// regular marketplace.
export async function getShopContext(): Promise<ShopContext | null> {
  const h = await headers()
  const slug = h.get(SHOP_SLUG_HEADER)
  if (!slug) return null
  const host = h.get('host') ?? ''
  const onSubdomain = getShopSlugFromHost(host, process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? '') === slug
  const base = onSubdomain ? '' : `/shop/${slug}`
  return { slug, base, home: base || '/' }
}
