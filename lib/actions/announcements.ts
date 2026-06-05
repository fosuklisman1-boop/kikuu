'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'

export async function createAnnouncement(message: string) {
  await requireAdmin()
  if (!message.trim()) return { error: 'Message cannot be empty' }
  const admin = createAdminClient()
  const { count } = await admin.from('announcements').select('*', { count: 'exact', head: true })
  const { error } = await admin.from('announcements').insert({ message: message.trim(), sort_order: count ?? 0 })
  if (error) return { error: error.message }
  revalidatePath('/admin/banner')
  return { success: true }
}

export async function updateAnnouncement(id: string, message: string, active: boolean) {
  await requireAdmin()
  if (!message.trim()) return { error: 'Message cannot be empty' }
  const admin = createAdminClient()
  const { error } = await admin.from('announcements').update({ message: message.trim(), active }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/banner')
  return { success: true }
}

export async function deleteAnnouncement(id: string) {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('announcements').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/banner')
  return { success: true }
}
