export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import ProductCard from '@/components/store/ProductCard'
import SearchBar from '@/components/store/SearchBar'
import CategoryFilter from '@/components/store/CategoryFilter'
import ProductTabs from '@/components/store/ProductTabs'
import { Suspense } from 'react'

interface Props {
  searchParams: Promise<{ q?: string; category?: string; page?: string; tab?: string; brand?: string }>
}

const PAGE_SIZE = 20

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams
  const query = params.q ?? ''
  const categorySlug = params.category ?? ''
  const page = parseInt(params.page ?? '1', 10)
  const tab = params.tab === 'preorder' ? 'preorder' : 'available'
  const brandSlug = params.brand ?? ''
  const from = (page - 1) * PAGE_SIZE

  const supabase = await createClient()

  // Resolve category id from slug
  let categoryId: string | null = null
  if (categorySlug) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', categorySlug)
      .single()
    categoryId = cat?.id ?? null
  }

  // Resolve brand slug to brand_id
  let brandId: string | null = null
  if (brandSlug) {
    const { data: brandRow } = await supabase
      .from('brands')
      .select('id')
      .eq('slug', brandSlug)
      .eq('active', true)
      .maybeSingle()
    brandId = brandRow?.id ?? null
  }

  const activeStatus = tab === 'preorder' ? 'pre_order' : 'active'

  function buildQuery(status: string, count?: boolean) {
    let q = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('status', status)
      .order('created_at', { ascending: false })
    if (query) q = q.textSearch('search_vector', query)
    if (categoryId) q = q.eq('category_id', categoryId)
    if (brandId) q = q.eq('brand_id', brandId)
    return q
  }

  // Fetch products for active tab + counts for both tabs (in parallel)
  const [
    { data: products, count: tabCount },
    { count: availableCount },
    { count: preorderCount },
    { data: categories },
    { data: trendingSearches },
  ] = await Promise.all([
    buildQuery(activeStatus).range(from, from + PAGE_SIZE - 1),
    buildQuery('active'),
    buildQuery('pre_order'),
    supabase.from('categories').select('*').is('parent_id', null).order('sort_order'),
    supabase.from('trending_searches').select('*').eq('active', true).order('sort_order').limit(8),
  ])

  const totalPages = Math.ceil((tabCount ?? 0) / PAGE_SIZE)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <SearchBar
          trendingSearches={trendingSearches ?? []}
          initialQuery={query ?? ''}
        />
      </div>

      <Suspense>
        <ProductTabs
          activeTab={tab}
          availableCount={availableCount ?? 0}
          preorderCount={preorderCount ?? 0}
        />
      </Suspense>

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="hidden lg:block w-52 shrink-0">
          <CategoryFilter categories={categories ?? []} selected={categorySlug} />
        </aside>

        {/* Products grid */}
        <div className="flex-1">
          <p className="text-xs text-gray-400 mb-4 font-medium tracking-wide uppercase">
            {tabCount ?? 0} product{tabCount !== 1 ? 's' : ''}{query ? ` for "${query}"` : ''}
          </p>

          {products && products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-28 text-gray-400">
              <p className="text-4xl mb-4">🔍</p>
              <p className="font-medium text-gray-600">
                {tab === 'preorder' ? 'No pre-order products yet.' : 'No products found.'}
              </p>
              {query && <p className="text-sm mt-1.5 text-gray-400">Try a different search term.</p>}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <a
                  key={p}
                  href={`/products?${new URLSearchParams({
                    ...(query && { q: query }),
                    ...(categorySlug && { category: categorySlug }),
                    ...(brandSlug && { brand: brandSlug }),
                    ...(tab === 'preorder' && { tab: 'preorder' }),
                    page: String(p),
                  })}`}
                  className={`px-3 py-1 rounded border text-sm ${p === page ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-700 hover:border-green-600'}`}
                >
                  {p}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
