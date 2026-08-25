'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireShopOwner } from '@/lib/auth/require-shop-owner'
import type { WalletTransaction } from '@/lib/supabase/types'

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
