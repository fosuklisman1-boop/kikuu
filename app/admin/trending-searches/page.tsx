export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import TrendingSearchManager from '@/components/admin/TrendingSearchManager'

export const metadata: Metadata = { title: 'Trending Searches' }

export default async function TrendingSearchesPage() {
  const admin = createAdminClient()
  const { data: searches } = await admin
    .from('trending_searches')
    .select('*')
    .order('sort_order')

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Trending Searches</h1>
        <p className="text-sm text-gray-500 mt-1">
          Up to 8 active searches shown in the search bar dropdown.
        </p>
      </div>
      <TrendingSearchManager initialSearches={searches ?? []} />
    </div>
  )
}
