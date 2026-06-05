import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Authorization guard for privileged server code.
 *
 * Call at the TOP of every mutating Server Action and every admin-only Route
 * Handler. Server Actions compile to public POST endpoints with stable IDs in
 * the client bundle — anyone can invoke them directly, so the role check in the
 * admin layout (which only gates page *rendering*) provides no protection here.
 *
 * Throws on failure (unauthenticated or non-admin); returns the admin's user id
 * on success. A thrown error surfaces to the caller as a rejected promise — fine
 * for an attacker, never hit by a legitimate admin.
 */
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Service-role read so the role lookup itself isn't subject to RLS.
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Forbidden: admin access required')
  return user.id
}
