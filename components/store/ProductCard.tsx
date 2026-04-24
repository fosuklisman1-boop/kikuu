'use client'

import Link from 'next/link'
import { formatGHS } from '@/lib/utils'
import type { Product, ProductAttributes } from '@/lib/supabase/types'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Clock } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { useWishlist } from '@/lib/wishlist'
import { useState, useEffect } from 'react'

export default function ProductCard({ product, salePrice }: { product: Product; salePrice?: number }) {
  const { addItem } = useCart()
  const { toggle, has } = useWishlist()
  const [added, setAdded] = useState(false)
  const [wishlisted, setWishlisted] = useState(false)
  const [cartError, setCartError] = useState('')
  const onSale = salePrice !== undefined && salePrice < product.price
  const displayPrice = onSale ? salePrice : product.price

  useEffect(() => {
    useWishlist.persist.rehydrate()
    setWishlisted(has(product.id))
  }, [product.id, has])

  const isPreorder = product.status === 'pre_order'
  const outOfStock = product.stock_qty === 0 && !isPreorder
  const attrs = (product.attributes ?? {}) as ProductAttributes
  const hasVariants = (attrs.colors?.length ?? 0) > 0 || (attrs.sizes?.length ?? 0) > 0
  // Flash sale takes precedence over compare_at_price discount
  const hasDiscount = !onSale && product.compare_at_price && product.compare_at_price > product.price
  const discountPct = onSale
    ? Math.round(((product.price - salePrice!) / product.price) * 100)
    : hasDiscount
    ? Math.round(((product.compare_at_price! - product.price) / product.compare_at_price!) * 100)
    : 0

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    if (outOfStock) return
    const result = addItem(onSale ? { ...product, price: salePrice! } : product)
    if (result?.error) {
      setCartError(result.error)
      setTimeout(() => setCartError(''), 4000)
      return
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  function handleWishlist(e: React.MouseEvent) {
    e.preventDefault()
    toggle(product.id)
    setWishlisted((w) => !w)
  }

  return (
    <div className="group relative">
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.14)] transition-shadow duration-300"
      >
        <Link href={`/products/${product.slug}`} className="block">
          {/* Image area */}
          <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[#fdf6ec] to-[#faecd8]">
            {product.images[0] ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">📦</div>
            )}

            {/* Top-left badges */}
            <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
              {isPreorder && (
                <span className="inline-flex items-center gap-1 bg-[#b45309] text-white text-[10px] font-bold tracking-wide px-2 py-1 rounded-lg shadow-sm">
                  <Clock size={9} />
                  Pre-order
                </span>
              )}
              {onSale && (
                <span className="bg-red-500 text-white text-[10px] font-extrabold tracking-wide px-2 py-1 rounded-lg shadow-sm tabular-nums">
                  SALE -{discountPct}%
                </span>
              )}
              {!isPreorder && !onSale && hasDiscount && (
                <span className="bg-[#b45309] text-white text-[10px] font-extrabold tracking-wide px-2 py-1 rounded-lg shadow-sm tabular-nums">
                  -{discountPct}%
                </span>
              )}
            </div>

            {/* Wishlist button — always visible */}
            <button
              onClick={handleWishlist}
              className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 z-10"
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart size={14} className={wishlisted ? 'fill-[#b45309] text-[#b45309]' : 'text-[#a89e96]'} />
            </button>

            {/* Out of stock overlay */}
            {outOfStock && (
              <div className="absolute inset-0 bg-white/75 backdrop-blur-[1.5px] flex items-center justify-center">
                <span className="text-[11px] font-semibold text-[#6b6360] bg-white px-3 py-1.5 rounded-full border border-[#ede8df] shadow-sm tracking-wide">
                  Out of Stock
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="px-3.5 pt-3 pb-3.5">
            <p className="text-[13px] font-medium text-[#0a0a0a] line-clamp-2 leading-[1.45] mb-2 group-hover:text-[#b45309] transition-colors">
              {product.name}
            </p>

            <div className="flex items-baseline gap-2 mb-2.5">
              <span className={`font-extrabold text-sm tracking-tight ${onSale ? 'text-red-500' : 'text-[#b45309]'}`}>
                {formatGHS(displayPrice)}
              </span>
              {onSale && (
                <span className="text-xs text-[#a89e96] line-through font-normal">
                  {formatGHS(product.price)}
                </span>
              )}
              {!onSale && hasDiscount && (
                <span className="text-xs text-[#a89e96] line-through font-normal">
                  {formatGHS(product.compare_at_price!)}
                </span>
              )}
            </div>

            {product.stock_qty > 0 && product.stock_qty <= 5 && !isPreorder && (
              <p className="text-[10px] text-[#b45309] font-semibold mb-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#b45309] rounded-full animate-pulse inline-block" />
                Only {product.stock_qty} left
              </p>
            )}

            {isPreorder && product.preorder_ship_date && (
              <p className="text-[10px] text-[#b45309] font-medium mb-2 tracking-wide">
                Ships {new Date(product.preorder_ship_date).toLocaleDateString('en-GH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}

            {/* Add to Cart / Choose Options button */}
            {hasVariants ? (
              <Link
                href={`/products/${product.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="block w-full py-2.5 rounded-xl text-[11px] font-bold tracking-wide text-center bg-[#b45309] hover:bg-[#92400e] text-white transition-colors"
              >
                Choose Options
              </Link>
            ) : (
              <button
                onClick={handleAdd}
                disabled={outOfStock}
                className={`w-full py-2.5 rounded-xl text-[11px] font-bold tracking-wide transition-colors ${
                  added
                    ? 'bg-green-500 text-white'
                    : outOfStock
                    ? 'bg-[#f5f0e8] text-[#a89e96] cursor-not-allowed'
                    : isPreorder
                    ? 'bg-[#b45309] hover:bg-[#92400e] text-white'
                    : 'bg-[#b45309] hover:bg-[#92400e] text-white'
                }`}
              >
                {added ? '✓ Added!' : isPreorder ? 'Pre-order Now' : outOfStock ? 'Out of Stock' : 'Add to Cart'}
              </button>
            )}
          </div>
        </Link>
      </motion.div>

      {/* Cart conflict error */}
      <AnimatePresence>
        {cartError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 -bottom-1 translate-y-full z-20 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-[11px] text-red-700 leading-snug shadow-lg"
          >
            {cartError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
