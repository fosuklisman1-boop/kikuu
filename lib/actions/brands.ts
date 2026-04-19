'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { slugify } from '@/lib/utils'
import type { Brand } from '@/lib/supabase/types'

export async function fetchBrands(): Promise<Brand[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('brands')
    .select('*')
    .eq('active', true)
    .order('sort_order')
  return data ?? []
}

export async function createBrand(formData: FormData) {
  const admin = createAdminClient()
  const name = formData.get('name') as string
  const { error } = await admin.from('brands').insert({
    name,
    slug: slugify(name),
    logo_url: formData.get('logo_url') as string,
    sort_order: Number(formData.get('sort_order') ?? 0),
    active: formData.get('active') === 'on',
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/brands')
  revalidatePath('/')
  return { success: true }
}

export async function updateBrand(id: string, formData: FormData) {
  const admin = createAdminClient()
  const name = formData.get('name') as string
  const { error } = await admin.from('brands').update({
    name,
    slug: slugify(name),
    logo_url: formData.get('logo_url') as string,
    sort_order: Number(formData.get('sort_order') ?? 0),
    active: formData.get('active') === 'on',
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/brands')
  revalidatePath('/')
  return { success: true }
}

export async function deleteBrand(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('brands').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/brands')
  revalidatePath('/')
  return { success: true }
}

export async function assignProductBrand(productId: string, brandId: string | null) {
  const admin = createAdminClient()
  const { error } = await admin.from('products').update({ brand_id: brandId }).eq('id', productId)
  if (error) return { error: error.message }
  revalidatePath('/admin/brands')
  return { success: true }
}
