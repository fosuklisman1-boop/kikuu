'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FlashSale, FlashSaleWithItems } from '@/lib/supabase/types'

export async function fetchActiveFlashSale(): Promise<FlashSaleWithItems | null> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data: sale, error: saleError } = await supabase
    .from('flash_sales')
    .select('*')
    .eq('active', true)
    .lte('starts_at', now)
    .gt('ends_at', now)
    .order('starts_at')
    .limit(1)
    .maybeSingle()

  if (saleError) { console.error('fetchActiveFlashSale:', saleError.message); return null }
  if (!sale) return null

  const { data: items } = await supabase
    .from('flash_sale_items')
    .select('*, product:products(*)')
    .eq('flash_sale_id', sale.id)
    .order('sort_order')

  return { ...sale, items: (items ?? []) as FlashSaleWithItems['items'] }
}

export async function fetchAllFlashSalesAdmin(): Promise<FlashSale[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('flash_sales')
    .select('*')
    .order('starts_at', { ascending: false })
  return data ?? []
}

export interface FlashSaleItemInput {
  product_id: string
  sale_price: number
  sort_order: number
}

export async function createFlashSale(
  title: string,
  starts_at: string,
  ends_at: string,
  active: boolean,
  items: FlashSaleItemInput[]
) {
  const admin = createAdminClient()
  const { data: sale, error } = await admin
    .from('flash_sales')
    .insert({ title, starts_at, ends_at, active })
    .select()
    .single()
  if (error || !sale) return { error: error?.message ?? 'Failed to create sale' }

  if (items.length > 0) {
    const { error: itemError } = await admin.from('flash_sale_items').insert(
      items.map((item) => ({ ...item, flash_sale_id: sale.id }))
    )
    if (itemError) return { error: itemError.message }
  }

  revalidatePath('/admin/flash-sales')
  revalidatePath('/')
  return { success: true, id: sale.id }
}

export async function updateFlashSale(
  id: string,
  title: string,
  starts_at: string,
  ends_at: string,
  active: boolean,
  items: FlashSaleItemInput[]
) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('flash_sales')
    .update({ title, starts_at, ends_at, active })
    .eq('id', id)
  if (error) return { error: error.message }

  // Replace all items: backup, delete, insert, restore-on-failure
  const { data: existingItems } = await admin
    .from('flash_sale_items')
    .select('product_id, sale_price, sort_order')
    .eq('flash_sale_id', id)

  await admin.from('flash_sale_items').delete().eq('flash_sale_id', id)

  if (items.length > 0) {
    const { error: itemError } = await admin.from('flash_sale_items').insert(
      items.map((item) => ({ ...item, flash_sale_id: id }))
    )
    if (itemError) {
      // Restore original items to avoid data loss
      if (existingItems && existingItems.length > 0) {
        await admin.from('flash_sale_items').insert(
          existingItems.map((item) => ({ ...item, flash_sale_id: id }))
        )
      }
      return { error: itemError.message }
    }
  }

  revalidatePath('/admin/flash-sales')
  revalidatePath('/')
  return { success: true }
}

export async function deleteFlashSale(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('flash_sales').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/flash-sales')
  revalidatePath('/')
  return { success: true }
}
