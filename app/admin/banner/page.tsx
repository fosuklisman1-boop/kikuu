export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import BannerManager from '@/components/admin/BannerManager'

export const metadata: Metadata = { title: 'Announcement Banner' }

export default async function BannerPage() {
  const admin = createAdminClient()
  const { data: messages } = await admin
    .from('announcements')
    .select('*')
    .order('sort_order')

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Announcement Banner</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage the scrolling messages shown at the top of the store.
        </p>
      </div>
      <BannerManager initialMessages={messages ?? []} />
    </div>
  )
}
