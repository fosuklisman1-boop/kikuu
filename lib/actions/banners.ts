'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Banner } from '@/lib/supabase/types'

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
  const admin = createAdminClient()
  const { error } = await admin.from('banners').insert({
    title: formData.get('title') as string,
    subtitle: (formData.get('subtitle') as string) || null,
    image_url: formData.get('image_url') as string,
    cta_text: (formData.get('cta_text') as string) || null,
    cta_link: (formData.get('cta_link') as string) || null,
    sort_order: Number(formData.get('sort_order') ?? 0),
    active: formData.get('active') === 'true',
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/banner')
  revalidatePath('/')
  return { success: true }
}

export async function updateBanner(id: string, formData: FormData) {
  const admin = createAdminClient()
  const { error } = await admin.from('banners').update({
    title: formData.get('title') as string,
    subtitle: (formData.get('subtitle') as string) || null,
    image_url: formData.get('image_url') as string,
    cta_text: (formData.get('cta_text') as string) || null,
    cta_link: (formData.get('cta_link') as string) || null,
    sort_order: Number(formData.get('sort_order') ?? 0),
    active: formData.get('active') === 'true',
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
