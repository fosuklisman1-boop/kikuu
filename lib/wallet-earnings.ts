import type { OrderItem } from '@/lib/supabase/types'

export function computeOrderEarnings(items: OrderItem[]): number {
  return items.reduce(
    (sum, item) => sum + (item.base_price !== null ? (item.price - item.base_price) * item.quantity : 0),
    0
  )
}
