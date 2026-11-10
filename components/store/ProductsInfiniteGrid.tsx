'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import ProductCard from './ProductCard'
import { fetchProductsPage, type ProductsPageFilters } from '@/lib/actions/products'
import type { Product } from '@/lib/supabase/types'

export default function ProductsInfiniteGrid({
  initialProducts,
  initialSalePrices,
  initialHasMore,
  filters,
  hasShop,
}: {
  initialProducts: Product[]
  initialSalePrices: Record<string, number>
  initialHasMore: boolean
  filters: ProductsPageFilters
  hasShop: boolean
}) {
  const [products, setProducts] = useState(initialProducts)
  const [salePrices, setSalePrices] = useState(initialSalePrices)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loading, setLoading] = useState(false)
  const pageRef = useRef(1)
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return
    loadingRef.current = true
    setLoading(true)
    const nextPage = pageRef.current + 1
    try {
      const result = await fetchProductsPage(filters, nextPage)
      setProducts((prev) => [...prev, ...result.products])
      setSalePrices((prev) => ({ ...prev, ...result.salePrices }))
      setHasMore(result.hasMore)
      pageRef.current = nextPage
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
    // filters is a plain object literal from the parent — stable in value,
    // not identity, so it's deliberately left out of the dependency array
    // (this component remounts on filter change via its `key` prop anyway).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: '600px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, hasMore])

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} salePrice={salePrices[product.id]} hasShop={hasShop} />
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-10">
          {loading && <Loader2 size={22} className="animate-spin text-gray-400" />}
        </div>
      )}
    </>
  )
}
