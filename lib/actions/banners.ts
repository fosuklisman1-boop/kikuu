'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Banner } from '@/lib/supabase/types'

const BannerSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().optional(),
  image_url: z.string().url(),
  cta_text: z.string().optional(),
  cta_link: z.string().url().optional().or(z.literal('')),
  sort_order: z.coerce.number().int().min(0).default(0),
  active: z.preprocess((v) => v === 'true', z.boolean()),
})

export async function fetchBanners(): Promise<Banner[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('banners')
    .select('*')
    .eq('active', true)
    .order('sort_order')
  return data ?? []
}

export async function fetchAllBannersAdmin(): Promise<Banner[]> {
  const admin = createAdminClient()
  const { data } = await admin.from('banners').select('*').order('sort_order')
  return data ?? []
}

export async function createBanner(formData: FormData) {
  const raw = Object.fromEntries(formData)
  const parsed = BannerSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const admin = createAdminClient()
  const { error } = await admin.from('banners').insert({
    ...parsed.data,
    subtitle: parsed.data.subtitle || null,
    cta_text: parsed.data.cta_text || null,
    cta_link: parsed.data.cta_link || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/banner')
  revalidatePath('/')
  return { success: true }
}

export async function updateBanner(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData)
  const parsed = BannerSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const admin = createAdminClient()
  const { error } = await admin.from('banners').update({
    ...parsed.data,
    subtitle: parsed.data.subtitle || null,
    cta_text: parsed.data.cta_text || null,
    cta_link: parsed.data.cta_link || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/banner')
  revalidatePath('/')
  return { success: true }
}

export async function deleteBanner(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('banners').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/banner')
  revalidatePath('/')
  return { success: true }
}
