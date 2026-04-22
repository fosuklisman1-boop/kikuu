'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function getCurrentPrices(
  productIds: string[]
): Promise<Record<string, number>> {
  if (!productIds.length) return {}

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const [{ data: products }, { data: activeSale }] = await Promise.all([
    admin.from('products').select('id, price').in('id', productIds),
    admin
      .from('flash_sales')
      .select('id')
      .eq('active', true)
      .lte('starts_at', now)
      .gt('ends_at', now)
      .maybeSingle(),
  ])

  const priceMap: Record<string, number> = {}
  for (const p of products ?? []) {
    priceMap[p.id] = p.price
  }

  if (activeSale) {
    const { data: saleItems } = await admin
      .from('flash_sale_items')
      .select('product_id, sale_price')
      .eq('flash_sale_id', activeSale.id)
      .in('product_id', productIds)

    for (const item of saleItems ?? []) {
      priceMap[item.product_id] = item.sale_price
    }
  }

  return priceMap
}
