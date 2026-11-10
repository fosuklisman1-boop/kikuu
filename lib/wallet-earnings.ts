import type { OrderItem } from '@/lib/supabase/types'

// Commission orders carry a commission_rate (percent of the sale) locked in at
// checkout. Orders placed under the old seller-markup model have no rate and
// are still valued by their markup, (price - base_price), so they credit
// exactly what they always did.
export function computeOrderEarnings(items: OrderItem[]): number {
  const total = items.reduce((sum, item) => {
    if (typeof item.commission_rate === 'number' && Number.isFinite(item.commission_rate)) {
      return sum + (item.price * item.quantity * item.commission_rate) / 100
    }
    if (typeof item.base_price === 'number' && Number.isFinite(item.base_price)) {
      return sum + (item.price - item.base_price) * item.quantity
    }
    return sum
  }, 0)
  return Math.round(total * 100) / 100
}
