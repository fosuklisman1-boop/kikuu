'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'
import { EMPTY_SUPPORT, validateSupport, type SupportSettings } from '@/lib/support'

// Public read (RLS allows select for everyone). Falls back to empty so a
// missing row / table never breaks a storefront page.
export async function getSupportSettings(): Promise<SupportSettings> {
  const supabase = await createClient()
  const { data } = await supabase.from('support_settings').select('email, phone, whatsapp').maybeSingle()
  return data ?? EMPTY_SUPPORT
}

export async function updateSupportSettings(input: SupportSettings) {
  await requireAdmin()
  const clean: SupportSettings = {
    email: input.email.trim(),
    phone: input.phone.trim(),
    whatsapp: input.whatsapp.trim(),
  }
  const err = validateSupport(clean)
  if (err) return { error: err }

  const admin = createAdminClient()
  const { error } = await admin
    .from('support_settings')
    .upsert({ id: true, ...clean, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) return { error: error.message }

  revalidatePath('/admin/support')
  revalidatePath('/', 'layout')
  return { success: true }
}
