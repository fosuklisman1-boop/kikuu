import { createAdminClient } from '@/lib/supabase/admin'
import { computeOrderEarnings } from '@/lib/wallet-earnings'
import type { OrderItem } from '@/lib/supabase/types'

// Called only from payment-confirmation code paths (Paystack inline callback,
// webhook). Re-verifies payment_status itself rather than trusting the caller.
export async function creditShopEarnings(orderId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('shop_id, order_number, items, payment_status')
    .eq('id', orderId)
    .single()

  if (orderError) throw new Error(orderError.message)
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
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('shop_id, order_number, status')
    .eq('id', orderId)
    .single()

  if (orderError) throw new Error(orderError.message)
  if (!order?.shop_id) return
  if (order.status !== 'cancelled' && order.status !== 'refunded') return

  const { data: credit, error: creditError } = await admin
    .from('wallet_transactions')
    .select('amount')
    .eq('order_id', orderId)
    .eq('type', 'credit')
    .maybeSingle()

  if (creditError) throw new Error(creditError.message)
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

export async function computeWithdrawableBalance(shopId: string): Promise<number> {
  const admin = createAdminClient()
  const [{ data: balanceRow }, { data: pending }] = await Promise.all([
    admin.from('wallet_balances').select('balance').eq('shop_id', shopId).maybeSingle(),
    admin.from('withdrawal_requests').select('amount').eq('shop_id', shopId).eq('status', 'pending').maybeSingle(),
  ])
  const balance = balanceRow?.balance ?? 0
  const pendingAmount = pending?.amount ?? 0
  return Math.max(0, balance - pendingAmount)
}

// Called only from markWithdrawalPaid (already requireAdmin()-gated). Re-verifies
// the request is actually 'paid' rather than trusting the caller, same discipline
// as creditShopEarnings/reverseShopEarnings above.
export async function debitWalletForWithdrawal(withdrawalRequestId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: request, error } = await admin
    .from('withdrawal_requests')
    .select('shop_id, amount, status')
    .eq('id', withdrawalRequestId)
    .single()
  if (error) throw new Error(error.message)
  if (!request || request.status !== 'paid') return

  const { error: insertError } = await admin.from('wallet_transactions').insert({
    shop_id: request.shop_id,
    order_id: null,
    withdrawal_request_id: withdrawalRequestId,
    type: 'debit',
    amount: request.amount,
    description: 'Withdrawal payout',
  })
  if (insertError && insertError.code !== '23505') throw new Error(insertError.message)
}
