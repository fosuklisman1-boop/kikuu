'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { slugify } from '@/lib/utils'
import { z } from 'zod'

const CategorySchema = z.object({
  name: z.string().min(2).max(100),
  parent_id: z.string().uuid().optional().or(z.literal('')),
  sort_order: z.coerce.number().int().min(0).default(0),
})

export async function createCategory(formData: FormData) {
  const raw = Object.fromEntries(formData)
  const parsed = CategorySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { parent_id, ...rest } = parsed.data
  const admin = createAdminClient()

  const { error } = await admin.from('categories').insert({
    ...rest,
    parent_id: parent_id || null,
    slug: slugify(rest.name),
  })

  if (error) {
    if (error.code === '23505') return { error: { name: ['A category with this name already exists.'] } }
    return { error: { _: [error.message] } }
  }

  revalidatePath('/admin/categories')
  revalidatePath('/')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const admin = createAdminClient()
  await admin.from('categories').delete().eq('id', id)
  revalidatePath('/admin/categories')
  revalidatePath('/')
}
