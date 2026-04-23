export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import BannerManager from '@/components/admin/BannerManager'

export const metadata: Metadata = { title: 'Banner Management' }

export default async function BannerPage() {
  const admin = createAdminClient()
  const [{ data: messages }, { data: banners }, { data: promoCards }, { data: coupons }] = await Promise.all([
    admin.from('announcements').select('*').order('sort_order'),
    admin.from('banners').select('*').order('sort_order'),
    admin.from('promo_cards').select('*, coupons(id,code)').order('sort_order'),
    admin.from('coupons').select('id,code,type,value').order('code'),
  ])

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Banner Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage the announcement bar, hero carousel slides, and promo cards.
        </p>
      </div>
      <BannerManager
        initialMessages={messages ?? []}
        initialBanners={banners ?? []}
        initialPromoCards={(promoCards ?? []) as any}
        coupons={coupons ?? []}
      />
    </div>
  )
}
