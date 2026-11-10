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

export interface PreorderRules {
  min_order_qty: number | null
  max_order_qty: number | null
  below_min_topup: number | null
}

// Current min/max/top-up for the given products, so carts saved before a
// rule existed (or before an admin changed it) pick up the live values.
export async function getPreorderRules(
  productIds: string[]
): Promise<Record<string, PreorderRules>> {
  if (!productIds.length) return {}
  const admin = createAdminClient()
  const { data } = await admin
    .from('products')
    .select('id, min_order_qty, max_order_qty, categories(below_min_topup)')
    .in('id', productIds)
  const out: Record<string, PreorderRules> = {}
  for (const p of (data ?? []) as any[]) {
    out[p.id] = {
      min_order_qty: p.min_order_qty ?? null,
      max_order_qty: p.max_order_qty ?? null,
      below_min_topup: Number(p.categories?.below_min_topup ?? 0) || null,
    }
  }
  return out
}
