export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import BannerManager from '@/components/admin/BannerManager'
import { fetchPromoCardsAdmin } from '@/lib/actions/promo-cards'
import type { PromoCardWithCoupon } from '@/lib/supabase/types'

export const metadata: Metadata = { title: 'Banner Management' }

export default async function BannerPage() {
  const admin = createAdminClient()
  const [{ data: messages }, { data: banners }, promoCards, { data: coupons }] = await Promise.all([
    admin.from('announcements').select('*').order('sort_order'),
    admin.from('banners').select('*').order('sort_order'),
    fetchPromoCardsAdmin(),
    admin.from('coupons').select('id, code, type, value').eq('active', true).order('code'),
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
        initialPromoCards={promoCards}
        coupons={coupons ?? []}
      />
    </div>
  )
}
