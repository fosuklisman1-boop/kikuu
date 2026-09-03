'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'

export async function getPaymentGatewaySettings(): Promise<{ paystackEnabled: boolean; tellerEnabled: boolean }> {
  const admin = createAdminClient()
  const { data } = await admin.from('payment_gateway_settings').select('*').eq('id', true).single()
  return {
    paystackEnabled: data?.paystack_enabled ?? true,
    tellerEnabled: data?.theteller_enabled ?? false,
  }
}

export async function updatePaymentGatewaySettings(formData: FormData): Promise<{ error?: string }> {
  await requireAdmin()
  const paystackEnabled = formData.get('paystack_enabled') === 'on'
  const tellerEnabled = formData.get('theteller_enabled') === 'on'
  if (!paystackEnabled && !tellerEnabled) {
    return { error: 'At least one payment gateway must stay enabled.' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('payment_gateway_settings')
    .update({ paystack_enabled: paystackEnabled, theteller_enabled: tellerEnabled, updated_at: new Date().toISOString() })
    .eq('id', true)
  if (error) return { error: error.message }
  revalidatePath('/admin/payments')
  revalidatePath('/checkout')
  return {}
}
