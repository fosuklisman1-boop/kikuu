'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updateDeliveryFee(region: string, fee: number, enabled: boolean) {
  if (fee < 0) return { error: 'Fee cannot be negative' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('delivery_fees')
    .upsert({ region, fee, enabled, updated_at: new Date().toISOString() })
  if (error) return { error: error.message }
  revalidatePath('/admin/delivery')
  return { success: true }
}
