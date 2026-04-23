'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { PromoCardWithCoupon } from '@/lib/supabase/types'

function revalidate() {
  revalidatePath('/admin/banner')
  revalidatePath('/')
}

export async function fetchPromoCardsAdmin(): Promise<PromoCardWithCoupon[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('promo_cards')
    .select('*, coupons(code, type, value)')
    .order('sort_order')
  return (data ?? []) as PromoCardWithCoupon[]
}

export async function fetchActivePromoCards(): Promise<PromoCardWithCoupon[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('promo_cards')
    .select('*, coupons(code, type, value)')
    .eq('active', true)
    .order('sort_order')
  return (data ?? []) as PromoCardWithCoupon[]
}

export async function createPromoCard(data: {
  heading: string
  subtext?: string | null
  badge_text?: string | null
  cta_text?: string | null
  cta_link?: string | null
  color_theme: 'amber' | 'green' | 'blue' | 'purple' | 'red'
  coupon_id?: string | null
  sort_order?: number
  active?: boolean
}) {
  if (!data.heading.trim()) return { error: 'Heading is required' }
  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from('promo_cards')
    .insert({
      heading: data.heading.trim(),
      subtext: data.subtext?.trim() || null,
      badge_text: data.badge_text?.trim() || null,
      cta_text: data.cta_text?.trim() || null,
      cta_link: data.cta_link?.trim() || null,
      color_theme: data.color_theme,
      coupon_id: data.coupon_id || null,
      sort_order: data.sort_order ?? 0,
      active: data.active ?? true,
    })
    .select('*, coupons(code, type, value)')
    .single()
  if (error) return { error: error.message }
  revalidate()
  return { success: true, data: row }
}

export async function updatePromoCard(
  id: string,
  data: {
    heading: string
    subtext?: string | null
    badge_text?: string | null
    cta_text?: string | null
    cta_link?: string | null
    color_theme: 'amber' | 'green' | 'blue' | 'purple' | 'red'
    coupon_id?: string | null
    sort_order?: number
    active?: boolean
  }
) {
  if (!data.heading.trim()) return { error: 'Heading is required' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('promo_cards')
    .update({
      heading: data.heading.trim(),
      subtext: data.subtext?.trim() || null,
      badge_text: data.badge_text?.trim() || null,
      cta_text: data.cta_text?.trim() || null,
      cta_link: data.cta_link?.trim() || null,
      color_theme: data.color_theme,
      coupon_id: data.coupon_id || null,
      sort_order: data.sort_order ?? 0,
      active: data.active ?? true,
    })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidate()
  return { success: true }
}

export async function deletePromoCard(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('promo_cards').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidate()
  return { success: true }
}

export async function togglePromoCard(id: string, active: boolean) {
  const admin = createAdminClient()
  const { error } = await admin.from('promo_cards').update({ active }).eq('id', id)
  if (error) return { error: error.message }
  revalidate()
  return { success: true }
}
