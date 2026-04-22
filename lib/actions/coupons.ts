'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function validateCoupon(
  code: string,
  subtotal: number
): Promise<{ discount: number; freeShipping?: boolean; error?: string }> {
  if (!code.trim()) return { discount: 0, error: 'Enter a coupon code' }

  const admin = createAdminClient()
  const { data: coupon } = await admin
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('active', true)
    .single()

  if (!coupon) return { discount: 0, error: 'Invalid or expired coupon' }

  if (coupon.expires_at && new Date(coupon.expires_at) <= new Date())
    return { discount: 0, error: 'This coupon has expired' }

  if (coupon.max_uses && coupon.used_count >= coupon.max_uses)
    return { discount: 0, error: 'Coupon usage limit reached' }

  if (coupon.min_order_amount && subtotal < coupon.min_order_amount)
    return { discount: 0, error: `Minimum order of GHS ${coupon.min_order_amount} required` }

  if (coupon.type === 'free_shipping') {
    return { discount: 0, freeShipping: true }
  }

  const discount =
    coupon.type === 'percentage'
      ? Math.round((subtotal * coupon.value) / 100 * 100) / 100
      : Math.min(coupon.value, subtotal)

  return { discount }
}

export async function createCoupon(data: {
  code: string
  type: 'percentage' | 'fixed' | 'free_shipping'
  value: number
  min_order_amount?: number | null
  max_uses?: number | null
  expires_at?: string | null
  active: boolean
}) {
  const admin = createAdminClient()
  const { error } = await admin.from('coupons').insert({
    ...data,
    code: data.code.toUpperCase().trim(),
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/coupons')
  return { success: true }
}

export async function updateCoupon(id: string, data: {
  code: string
  type: 'percentage' | 'fixed' | 'free_shipping'
  value: number
  min_order_amount?: number | null
  max_uses?: number | null
  expires_at?: string | null
  active: boolean
}) {
  const admin = createAdminClient()
  const { error } = await admin.from('coupons').update({
    ...data,
    code: data.code.toUpperCase().trim(),
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/coupons')
  return { success: true }
}

export async function deleteCoupon(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('coupons').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/coupons')
  return { success: true }
}

export async function toggleCoupon(id: string, active: boolean) {
  const admin = createAdminClient()
  const { error } = await admin.from('coupons').update({ active }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/coupons')
  return { success: true }
}
