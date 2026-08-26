import type { OrderItem } from '@/lib/supabase/types'

export function computeOrderEarnings(items: OrderItem[]): number {
  const total = items.reduce(
    (sum, item) =>
      sum + (typeof item.base_price === 'number' && Number.isFinite(item.base_price)
        ? (item.price - item.base_price) * item.quantity
        : 0),
    0
  )
  return Math.round(total * 100) / 100
}
