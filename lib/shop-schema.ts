import { z } from 'zod'

export const ShopSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/, 'Slug must be 3-40 lowercase letters, numbers, or hyphens'),
})
