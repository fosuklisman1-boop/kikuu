'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'

export async function getDefaultCommissionPercent(): Promise<number> {
  await requireAdmin()
  const admin = createAdminClient()
  const { data } = await admin.from('commission_settings').select('default_percent').eq('id', true).single()
  return Number(data?.default_percent ?? 0)
}

export async function updateDefaultCommissionPercent(percent: number): Promise<{ error?: string }> {
  await requireAdmin()
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return { error: 'Enter a percent between 0 and 100.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('commission_settings')
    .update({ default_percent: Math.round(percent * 100) / 100 })
    .eq('id', true)
  if (error) return { error: error.message }

  revalidatePath('/admin/shops')
  revalidatePath('/seller/links')
  return {}
}
