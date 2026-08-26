'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireShopOwner } from '@/lib/auth/require-shop-owner'
import { computeWithdrawableBalance, debitWalletForWithdrawal } from '@/lib/wallet-ledger'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { WithdrawalRequestWithShop } from '@/lib/supabase/types'

const AmountSchema = z.coerce.number().positive()

export async function requestWithdrawal(formData: FormData): Promise<{ error?: string }> {
  const { shopId } = await requireShopOwner()
  const admin = createAdminClient()

  const { data: shop } = await admin.from('shops').select('momo_number, momo_name').eq('id', shopId).single()
  if (!shop?.momo_number || !shop?.momo_name) {
    return { error: 'Add your MoMo details before requesting a withdrawal.' }
  }

  const parsedAmount = AmountSchema.safeParse(formData.get('amount'))
  if (!parsedAmount.success) return { error: 'Enter a valid amount.' }
  const amount = parsedAmount.data

  const { data: settings } = await admin.from('withdrawal_settings').select('min_amount').eq('id', true).single()
  const minAmount = settings?.min_amount ?? 0
  if (amount < minAmount) return { error: `Minimum withdrawal is GHS ${minAmount.toFixed(2)}.` }

  const available = await computeWithdrawableBalance(shopId)
  if (amount > available) return { error: 'Amount exceeds your available balance.' }

  const { error } = await admin.from('withdrawal_requests').insert({
    shop_id: shopId,
    amount,
    momo_number: shop.momo_number,
    momo_name: shop.momo_name,
  })
  if (error) {
    if (error.code === '23505') return { error: 'You already have a pending withdrawal request.' }
    return { error: error.message }
  }

  revalidatePath('/seller/wallet')
  return {}
}

export async function getPendingWithdrawalRequests(): Promise<WithdrawalRequestWithShop[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const { data } = await admin
    .from('withdrawal_requests')
    .select('*, shop:shops(id, name, slug)')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
  return (data ?? []) as unknown as WithdrawalRequestWithShop[]
}

export async function getWithdrawalHistory(): Promise<WithdrawalRequestWithShop[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const { data } = await admin
    .from('withdrawal_requests')
    .select('*, shop:shops(id, name, slug)')
    .neq('status', 'pending')
    .order('processed_at', { ascending: false })
    .limit(100)
  return (data ?? []) as unknown as WithdrawalRequestWithShop[]
}

export async function markWithdrawalPaid(requestId: string): Promise<{ error?: string }> {
  const adminUserId = await requireAdmin()
  const admin = createAdminClient()

  const { data: updated, error } = await admin
    .from('withdrawal_requests')
    .update({ status: 'paid', processed_at: new Date().toISOString(), processed_by: adminUserId })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id')

  if (error) return { error: error.message }
  if (!updated || updated.length === 0) return { error: 'This request was already processed.' }

  try {
    await debitWalletForWithdrawal(requestId)
  } catch (err) {
    console.error('debitWalletForWithdrawal failed after marking paid:', err)
    return {
      error: 'Marked as paid, but recording the wallet debit failed. Use Manual Adjustment to debit this shop for the payout amount (with this request\'s order number left blank), then investigate.',
    }
  }

  revalidatePath('/admin/withdrawals')
  revalidatePath('/seller/wallet')
  return {}
}

export async function rejectWithdrawal(requestId: string, reason: string): Promise<{ error?: string }> {
  const adminUserId = await requireAdmin()
  if (!reason.trim()) return { error: 'A reason is required.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('withdrawal_requests')
    .update({ status: 'rejected', admin_note: reason, processed_at: new Date().toISOString(), processed_by: adminUserId })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (error) return { error: error.message }
  revalidatePath('/admin/withdrawals')
  revalidatePath('/seller/wallet')
  return {}
}

export async function updateMinWithdrawalAmount(minAmount: number): Promise<{ error?: string }> {
  await requireAdmin()
  if (!Number.isFinite(minAmount) || minAmount < 0) return { error: 'Enter a valid amount.' }

  const admin = createAdminClient()
  const { error } = await admin.from('withdrawal_settings').update({ min_amount: minAmount }).eq('id', true)
  if (error) return { error: error.message }
  revalidatePath('/admin/withdrawals')
  return {}
}

// Manual wallet adjustment — the in-app remedy for two gaps parked during the
// wallet ledger's final review: a refund processed only in the Paystack
// dashboard (never auto-reversed), and an order that was wrongly cancelled
// and un-cancelled (the ledger's own idempotency makes that un-recoverable
// automatically). Requires a mandatory reason for auditability.
export async function adjustWalletBalance(
  shopSlug: string,
  type: 'credit' | 'debit',
  amount: number,
  reason: string,
  orderNumber?: string
): Promise<{ error?: string }> {
  await requireAdmin()
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter a valid amount.' }
  if (!reason.trim()) return { error: 'A reason is required for every manual adjustment.' }

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('id').eq('slug', shopSlug).single()
  if (!shop) return { error: 'No shop found with that URL slug.' }

  let orderId: string | null = null
  if (orderNumber && orderNumber.trim()) {
    const { data: order } = await admin.from('orders').select('id').eq('order_number', orderNumber.trim()).single()
    if (!order) return { error: 'No order found with that order number.' }
    orderId = order.id
  }

  const { error } = await admin.from('wallet_transactions').insert({
    shop_id: shop.id,
    order_id: orderId,
    withdrawal_request_id: null,
    type,
    amount,
    description: `Manual adjustment: ${reason.trim()}`,
  })
  if (error) {
    if (error.code === '23505') {
      return { error: 'A ledger entry already exists for this order in this direction — it may already have been reversed or credited automatically. Leave the order number blank to record an adjustment unrelated to a specific order.' }
    }
    return { error: error.message }
  }
  revalidatePath('/admin/withdrawals')
  revalidatePath('/admin/shops')
  return {}
}
