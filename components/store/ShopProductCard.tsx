'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatGHS } from '@/lib/utils'
import { useCart } from '@/lib/cart'
import type { ShopProductPriced } from '@/lib/supabase/types'
import { shopProductHref } from '@/lib/shop-url'

export default function ShopProductCard({
  shopId,
  shopSlug,
  item,
  onSubdomain,
}: {
  shopId: string
  shopSlug: string
  item: ShopProductPriced
  onSubdomain: boolean
}) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const [cartError, setCartError] = useState('')
  const product = item.product
  const outOfStock = product.stock_qty === 0 && product.status !== 'pre_order'
  const isPreorder = product.status === 'pre_order'

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    if (outOfStock) return
    const result = addItem(
      { ...product, price: item.shop_price }, 1, undefined, undefined,
      { shopId, shopSlug }
    )
    if (result?.error) {
      setCartError(result.error)
      setTimeout(() => setCartError(''), 4000)
      return
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div className="group relative">
      <Link
        href={shopProductHref(shopSlug, product.slug, onSubdomain)}
        className="block bg-white rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.14)] transition-shadow duration-300"
      >
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[#fdf6ec] to-[#faecd8]">
          {product.images[0] ? (
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">📦</div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 bg-white/75 backdrop-blur-[1.5px] flex items-center justify-center">
              <span className="text-[11px] font-semibold text-[#6b6360] bg-white px-3 py-1.5 rounded-full border border-[#ede8df] shadow-sm tracking-wide">
                Out of Stock
              </span>
            </div>
          )}
          {isPreorder && (
            <div className="absolute top-2 left-2 bg-orange-50 text-orange-700 text-[10px] font-semibold px-2 py-1 rounded-full border border-orange-200">
              Pre-order
            </div>
          )}
        </div>

        <div className="px-3.5 pt-3 pb-3.5">
          <p className="text-[13px] font-medium text-[#0a0a0a] line-clamp-2 leading-[1.45] mb-2">{product.name}</p>
          <div className="flex items-baseline gap-2 mb-2.5">
            <span className="font-extrabold text-sm tracking-tight text-[#b45309]">{formatGHS(item.shop_price)}</span>
          </div>
          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className={`w-full py-2.5 rounded-xl text-[11px] font-bold tracking-wide transition-colors ${
              added
                ? 'bg-green-500 text-white'
                : outOfStock
                ? 'bg-[#f5f0e8] text-[#a89e96] cursor-not-allowed'
                : 'bg-[#b45309] hover:bg-[#92400e] text-white'
            }`}
          >
            {added ? '✓ Added!' : outOfStock ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </Link>

      {cartError && (
        <div className="absolute inset-x-0 -bottom-1 translate-y-full z-20 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-[11px] text-red-700 leading-snug shadow-lg">
          {cartError}
        </div>
      )}
    </div>
  )
}
