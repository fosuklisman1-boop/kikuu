import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Authorization guard for privileged seller server code. Mirrors requireAdmin()
 * (lib/auth/require-admin.ts): call at the TOP of every mutating seller Server
 * Action. Throws on failure; returns the owner's user id and shop id on success.
 */
export async function requireShopOwner(): Promise<{ userId: string; shopId: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { data: shop } = await admin
    .from('shops')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!shop) throw new Error('Forbidden: no shop found for this user')
  return { userId: user.id, shopId: shop.id }
}
