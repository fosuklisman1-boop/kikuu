export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import BannerManager from '@/components/admin/BannerManager'

export const metadata: Metadata = { title: 'Banner Management' }

export default async function BannerPage() {
  const admin = createAdminClient()
  const [{ data: messages }, { data: banners }] = await Promise.all([
    admin.from('announcements').select('*').order('sort_order'),
    admin.from('banners').select('*').order('sort_order'),
  ])

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Banner Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage the announcement bar and hero carousel slides.
        </p>
      </div>
      <BannerManager initialMessages={messages ?? []} initialBanners={banners ?? []} />
    </div>
  )
}
