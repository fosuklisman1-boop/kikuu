import Navbar from '@/components/store/Navbar'
import Footer from '@/components/store/Footer'
import AnnouncementBar from '@/components/store/AnnouncementBar'
import { Suspense } from 'react'
import BottomTabBar from '@/components/store/BottomTabBar'
import ShopNavbar from '@/components/store/ShopNavbar'
import ShopBottomTabBar from '@/components/store/ShopBottomTabBar'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchTrendingSearches } from '@/lib/actions/trending-searches'
import { getShopContext } from '@/lib/shop-context'
import { getSupportSettings } from '@/lib/actions/support'
import SupportContact from '@/components/store/SupportContact'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const shopCtx = await getShopContext()
  const support = await getSupportSettings()

  // Single-shop storefront (shop subdomain or /shop/<slug>): render shop-only
  // chrome so nothing on screen links to the wider marketplace.
  if (shopCtx) {
    const { data: shop } = await supabase
      .from('shops')
      .select('name')
      .eq('slug', shopCtx.slug)
      .eq('active', true)
      .single()
    if (!shop) notFound()

    return (
      <>
        <ShopNavbar shopName={shop.name} home={shopCtx.home} />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <footer className="border-t border-[#ede8df] px-4 pt-6 pb-24 md:pb-6 text-center text-xs text-[#a89e96]">
          <SupportContact support={support} className="mb-4 flex flex-col items-center [&>div]:justify-center" />
          © {new Date().getFullYear()} {shop.name}
        </footer>
        <ShopBottomTabBar home={shopCtx.home} />
      </>
    )
  }

  const [{ data: categories }, trendingSearches] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    fetchTrendingSearches(),
  ])

  const cats = categories ?? []

  return (
    <>
      <AnnouncementBar />
      <Navbar categories={cats} trendingSearches={trendingSearches} />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer support={support} />
      <Suspense><BottomTabBar /></Suspense>
    </>
  )
}
