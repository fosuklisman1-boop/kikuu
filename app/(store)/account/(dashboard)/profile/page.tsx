import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import ProfileForm from '@/components/store/ProfileForm'
import type { SavedAddress } from '@/lib/supabase/types'

export type { SavedAddress }

export const metadata: Metadata = { title: 'Profile & Addresses' }

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const meta = user.user_metadata as Record<string, string> | null
  const addresses: SavedAddress[] = meta?.addresses ? JSON.parse(meta.addresses) : []

  return (
    <ProfileForm
      email={user.email ?? ''}
      initialName={meta?.full_name ?? ''}
      initialPhone={meta?.phone ?? ''}
      initialAddresses={addresses}
    />
  )
}

