'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'
import type { Shop } from '@/lib/supabase/types'

export interface ShopWithStats extends Shop {
  owner_email: string | null
  product_count: number
  wallet_balance: number
}

export async function getAllShops(): Promise<ShopWithStats[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: shops } = await admin.from('shops').select('*').order('created_at', { ascending: false })
  if (!shops || shops.length === 0) return []

  // public.users has no email column (it only mirrors id/role). Email lives
  // in auth.users, which the Admin Auth API reads correctly with the
  // service-role key — a plain .from('users') query would NOT have it.
  const shopIds = shops.map((s) => s.id)
  const [{ data: userPage }, { data: counts }, { data: balances }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('shop_products').select('shop_id').in('shop_id', shopIds),
    admin.from('wallet_balances').select('shop_id, balance').in('shop_id', shopIds),
  ])

  const emailByOwner = new Map((userPage?.users ?? []).map((u) => [u.id, u.email ?? null]))
  const countByShop = new Map<string, number>()
  for (const row of counts ?? []) {
    countByShop.set(row.shop_id, (countByShop.get(row.shop_id) ?? 0) + 1)
  }
  const balanceByShop = new Map((balances ?? []).map((b) => [b.shop_id, b.balance]))

  return shops.map((s) => ({
    ...s,
    owner_email: emailByOwner.get(s.owner_id) ?? null,
    product_count: countByShop.get(s.id) ?? 0,
    wallet_balance: balanceByShop.get(s.id) ?? 0,
  }))
}

export async function toggleShopActive(shopId: string, active: boolean): Promise<{ error?: string }> {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('shops').update({ active }).eq('id', shopId)
  if (error) return { error: error.message }
  revalidatePath('/admin/shops')
  return {}
}
