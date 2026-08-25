import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import SellerSidebar from '@/components/seller/SellerSidebar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: { template: '%s | Seller', default: 'Seller' } }

export default async function SellerShopLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/account/login?redirect=/seller')

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('*').eq('owner_id', user.id).single()
  if (!shop) redirect('/seller/onboarding')

  return (
    <div className="flex h-screen bg-gray-100">
      <SellerSidebar shopName={shop.name} shopSlug={shop.slug} />
      <main className="flex-1 min-w-0 overflow-auto p-4 lg:p-6 pt-16 lg:pt-6">{children}</main>
    </div>
  )
}
