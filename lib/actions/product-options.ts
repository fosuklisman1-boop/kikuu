'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { ProductColor, ProductSize } from '@/lib/supabase/types'

function revalidate() {
  revalidatePath('/admin/product-options')
  revalidatePath('/admin/products')
}

export async function fetchProductColors(): Promise<ProductColor[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('product_colors')
    .select('*')
    .order('sort_order')
  return (data ?? []) as ProductColor[]
}

export async function fetchProductSizes(): Promise<ProductSize[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('product_sizes')
    .select('*')
    .order('sort_order')
  return (data ?? []) as ProductSize[]
}

export async function createProductColor(data: { name: string; hex: string }) {
  if (!data.name.trim()) return { error: 'Name is required' }
  if (!/^#[0-9a-fA-F]{6}$/.test(data.hex)) return { error: 'Invalid hex color' }
  const admin = createAdminClient()
  const { error } = await admin.from('product_colors').insert({
    name: data.name.trim(),
    hex: data.hex.toLowerCase(),
    sort_order: 0,
    active: true,
  })
  if (error) return { error: error.code === '23505' ? 'A color with that name already exists' : error.message }
  revalidate()
  return { success: true }
}

export async function createProductSize(data: { name: string }) {
  if (!data.name.trim()) return { error: 'Name is required' }
  const admin = createAdminClient()
  const { error } = await admin.from('product_sizes').insert({
    name: data.name.trim(),
    sort_order: 0,
    active: true,
  })
  if (error) return { error: error.code === '23505' ? 'A size with that name already exists' : error.message }
  revalidate()
  return { success: true }
}

export async function deleteProductColor(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('product_colors').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidate()
  return { success: true }
}

export async function deleteProductSize(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('product_sizes').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidate()
  return { success: true }
}
