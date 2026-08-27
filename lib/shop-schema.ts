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
