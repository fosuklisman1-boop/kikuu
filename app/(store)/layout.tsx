import Navbar from '@/components/store/Navbar'
import Footer from '@/components/store/Footer'
import AnnouncementBar from '@/components/store/AnnouncementBar'
import BottomTabBar from '@/components/store/BottomTabBar'
import { createClient } from '@/lib/supabase/server'
import { fetchTrendingSearches } from '@/lib/actions/trending-searches'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
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
      <Footer />
      <BottomTabBar categories={cats} />
    </>
  )
}
