'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireShopOwner } from '@/lib/auth/require-shop-owner'
import { computeWithdrawableBalance } from '@/lib/wallet-ledger'
import type { WalletTransaction, WithdrawalSettings, WithdrawalRequest } from '@/lib/supabase/types'

export async function getWalletBalance(): Promise<number> {
  const { shopId } = await requireShopOwner()
  const admin = createAdminClient()
  const { data } = await admin.from('wallet_balances').select('balance').eq('shop_id', shopId).maybeSingle()
  return data?.balance ?? 0
}

export async function getWalletTransactions(): Promise<WalletTransaction[]> {
  const { shopId } = await requireShopOwner()
  const admin = createAdminClient()
  const { data } = await admin
    .from('wallet_transactions')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getWithdrawableBalance(): Promise<number> {
  const { shopId } = await requireShopOwner()
  return computeWithdrawableBalance(shopId)
}

export async function getWithdrawalSettings(): Promise<WithdrawalSettings> {
  const admin = createAdminClient()
  const { data } = await admin.from('withdrawal_settings').select('*').eq('id', true).single()
  return data ?? { id: true, min_amount: 50, updated_at: new Date().toISOString() }
}

export async function updateShopPayoutDetails(formData: FormData): Promise<{ error?: string }> {
  const { shopId } = await requireShopOwner()
  const momoNumber = String(formData.get('momo_number') ?? '').trim()
  const momoName = String(formData.get('momo_name') ?? '').trim()
  if (!/^0\d{9}$/.test(momoNumber)) return { error: 'Enter a valid 10-digit MoMo number (e.g. 0241234567).' }
  if (momoName.length < 2) return { error: 'Enter the name on the MoMo account.' }

  const admin = createAdminClient()
  const { error } = await admin.from('shops').update({ momo_number: momoNumber, momo_name: momoName }).eq('id', shopId)
  if (error) return { error: error.message }
  revalidatePath('/seller/wallet')
  return {}
}

export async function getMyWithdrawalRequests(): Promise<WithdrawalRequest[]> {
  const { shopId } = await requireShopOwner()
  const admin = createAdminClient()
  const { data } = await admin
    .from('withdrawal_requests')
    .select('*')
    .eq('shop_id', shopId)
    .order('requested_at', { ascending: false })
  return data ?? []
}
