import { createAdminClient } from '@/lib/supabase/admin'
import { computeOrderEarnings } from '@/lib/wallet-earnings'
import type { OrderItem } from '@/lib/supabase/types'

// Called only from payment-confirmation code paths (Paystack inline callback,
// webhook). Re-verifies payment_status itself rather than trusting the caller.
export async function creditShopEarnings(orderId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('shop_id, order_number, items, payment_status')
    .eq('id', orderId)
    .single()

  if (!order?.shop_id) return
  if (order.payment_status !== 'paid') return

  const amount = computeOrderEarnings((order.items as OrderItem[]) ?? [])
  if (amount <= 0) return

  const { error } = await admin.from('wallet_transactions').insert({
    shop_id: order.shop_id,
    order_id: orderId,
    type: 'credit',
    amount,
    description: `Earnings from order ${order.order_number}`,
  })
  if (error && error.code !== '23505') throw new Error(error.message)
}

// Called only from the admin order-status update action. Re-verifies the
// order's current status itself rather than trusting the caller.
export async function reverseShopEarnings(orderId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('shop_id, order_number, status')
    .eq('id', orderId)
    .single()

  if (!order?.shop_id) return
  if (order.status !== 'cancelled' && order.status !== 'refunded') return

  const { data: credit } = await admin
    .from('wallet_transactions')
    .select('amount')
    .eq('order_id', orderId)
    .eq('type', 'credit')
    .maybeSingle()

  if (!credit) return

  const { error } = await admin.from('wallet_transactions').insert({
    shop_id: order.shop_id,
    order_id: orderId,
    type: 'debit',
    amount: credit.amount,
    description: `Reversal for cancelled/refunded order ${order.order_number}`,
  })
  if (error && error.code !== '23505') throw new Error(error.message)
}
