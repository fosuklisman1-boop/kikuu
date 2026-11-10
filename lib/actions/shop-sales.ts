'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireShopOwner } from '@/lib/auth/require-shop-owner'
import { computeOrderEarnings } from '@/lib/wallet-earnings'
import type { OrderItem } from '@/lib/supabase/types'

export type SaleCommissionStatus = 'earned' | 'pending' | 'reversed'

export interface ShopSale {
  id: string
  order_number: string
  created_at: string
  items: OrderItem[]
  sale_amount: number
  commission: number
  status: SaleCommissionStatus
}

export interface ShopSalesSummary {
  totalSales: number
  earned: number
  pending: number
  sales: ShopSale[]
}

export async function getShopSales(): Promise<ShopSalesSummary> {
  const { shopId } = await requireShopOwner()
  const admin = createAdminClient()

  const { data: orders } = await admin
    .from('orders')
    .select('id, order_number, created_at, items, subtotal, status')
    .eq('shop_id', shopId)
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: false })
    .limit(200)

  const orderIds = (orders ?? []).map((o) => o.id)
  const credited = new Set<string>()
  if (orderIds.length > 0) {
    const { data: credits } = await admin
      .from('wallet_transactions')
      .select('order_id')
      .eq('shop_id', shopId)
      .eq('type', 'credit')
      .in('order_id', orderIds)
    for (const c of credits ?? []) if (c.order_id) credited.add(c.order_id)
  }

  let totalSales = 0
  let earned = 0
  let pending = 0

  const sales: ShopSale[] = (orders ?? []).map((o) => {
    const items = (o.items as OrderItem[]) ?? []
    const commission = computeOrderEarnings(items)
    const reversed = o.status === 'cancelled' || o.status === 'refunded'
    const status: SaleCommissionStatus = reversed ? 'reversed' : credited.has(o.id) ? 'earned' : 'pending'

    if (!reversed) {
      totalSales += Number(o.subtotal)
      if (status === 'earned') earned += commission
      else pending += commission
    }

    return {
      id: o.id,
      order_number: o.order_number,
      created_at: o.created_at,
      items,
      sale_amount: Number(o.subtotal),
      commission,
      status,
    }
  })

  const round = (n: number) => Math.round(n * 100) / 100
  return { totalSales: round(totalSales), earned: round(earned), pending: round(pending), sales }
}
