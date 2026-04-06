'use client'

import { useWishlist } from '@/lib/wishlist'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProductCard from '@/components/store/ProductCard'
import type { Product } from '@/lib/supabase/types'
import { Heart, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function WishlistContent() {
  const { ids } = useWishlist()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    useWishlist.persist.rehydrate()
  }, [])

  useEffect(() => {
    if (ids.length === 0) {
      setProducts([])
      setLoading(false)
      return
    }
    const supabase = createClient()
    supabase
      .from('products')
      .select('*')
      .in('id', ids)
      .then(({ data }) => {
        setProducts((data as Product[]) ?? [])
        setLoading(false)
      })
  }, [ids])

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 aspect-square shimmer" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">My Wishlist</h1>
        <span className="text-sm text-gray-400">{products.length} item{products.length !== 1 ? 's' : ''}</span>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Heart size={28} className="text-red-300" />
          </div>
          <p className="text-gray-600 font-semibold mb-1">Your wishlist is empty</p>
          <p className="text-gray-400 text-sm mb-5">Tap the ❤️ on any product to save it here.</p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            Browse Products <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </div>
  )
}
