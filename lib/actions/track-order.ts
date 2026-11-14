'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShopContext } from '@/lib/shop-context'

export interface TrackState {
  error?: string
}

// Ghana numbers are written many ways (0241234567, +233241234567, 233...).
// Comparing the last 9 digits makes them all equal.
function phoneKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-9)
}

const NOT_FOUND = 'We could not find an order matching that order number and phone number.'

// Guest-safe order lookup: needs BOTH the order number and the phone it was
// placed with, so order numbers alone can't be enumerated. On a shop
// storefront, only that shop's orders can be found.
export async function trackOrder(_prev: TrackState, formData: FormData): Promise<TrackState> {
  const orderNumber = String(formData.get('order_number') ?? '').trim().toUpperCase()
  const phone = String(formData.get('phone') ?? '')
  if (!orderNumber || phoneKey(phone).length < 9) {
    return { error: 'Enter your order number and the phone number used for the order.' }
  }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, buyer_phone, shop_id')
    .eq('order_number', orderNumber)
    .maybeSingle()

  if (!order || phoneKey(order.buyer_phone) !== phoneKey(phone)) return { error: NOT_FOUND }

  const shopCtx = await getShopContext()
  if (shopCtx) {
    const { data: shop } = await admin.from('shops').select('id').eq('slug', shopCtx.slug).single()
    if (!shop || order.shop_id !== shop.id) return { error: NOT_FOUND }
  }

  redirect(`/orders/${order.id}`)
}
