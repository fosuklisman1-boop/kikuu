'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ShopSchema, RESERVED_SHOP_SLUGS } from '@/lib/shop-schema'
import type { Shop } from '@/lib/supabase/types'

export async function getMyShop(): Promise<Shop | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data } = await admin.from('shops').select('*').eq('owner_id', user.id).single()
  return data ?? null
}

export async function checkSlugAvailable(slug: string): Promise<boolean> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return false
  if (RESERVED_SHOP_SLUGS.has(slug)) return false
  const admin = createAdminClient()
  const { data } = await admin.from('shops').select('id').eq('slug', slug).maybeSingle()
  return !data
}

export async function createShop(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to open a shop.' }

  const existing = await getMyShop()
  if (existing) return { error: 'You already have a shop.' }

  const raw = Object.fromEntries(formData)
  const parsed = ShopSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid shop details.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('shops').insert({
    owner_id: user.id,
    name: parsed.data.name,
    slug: parsed.data.slug,
    active: true,
  })

  if (error) {
    if (error.code === '23505') return { error: 'That shop URL is already taken. Please choose another.' }
    return { error: error.message }
  }

  revalidatePath('/seller')
  redirect('/seller/dashboard')
}
