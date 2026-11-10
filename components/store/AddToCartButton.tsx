'use client'

import { useCart } from '@/lib/cart'
import type { Product } from '@/lib/supabase/types'
import { ShoppingCart, Check, Clock, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AddToCartButton({
  product,
  disabled,
  selectionHint,
  salePrice,
  selectedColor,
  selectedSize,
  shopId,
  shopSlug,
  shopPrice,
}: {
  product: Product
  disabled?: boolean
  selectionHint?: string
  salePrice?: number
  selectedColor?: { name: string; hex: string }
  selectedSize?: string
  shopId?: string
  shopSlug?: string
  shopPrice?: number
}) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const [cartError, setCartError] = useState('')
  const isPreorder = product.status === 'pre_order'

  const minQty = product.min_order_qty ?? 1
  const maxQty = product.max_order_qty ? Math.min(product.stock_qty, product.max_order_qty) : product.stock_qty
  const [qty, setQty] = useState(minQty)

  function handleAdd() {
    const overridePrice = shopPrice ?? (salePrice !== undefined && salePrice < product.price ? salePrice : undefined)
    const itemToAdd = overridePrice !== undefined ? { ...product, price: overridePrice } : product
    const shopContext = shopId && shopSlug ? { shopId, shopSlug } : undefined
    const result = addItem(itemToAdd, qty, selectedColor, selectedSize, shopContext)
    if (result?.error) {
      setCartError(result.error)
      setTimeout(() => setCartError(''), 5000)
      return
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
    setQty(minQty)
  }

  return (
    <div className="space-y-2">
      {!disabled && maxQty >= minQty && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-600">Quantity</span>
          <div className="flex items-center gap-0 border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(minQty, q - 1))}
              disabled={qty <= minQty}
              className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Minus size={13} />
            </button>
            <span className="w-11 text-center text-sm font-semibold text-gray-900 border-x border-gray-200">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              disabled={qty >= maxQty}
              className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      )}

      {cartError && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 leading-relaxed"
        >
          {cartError}
        </motion.p>
      )}

      <motion.button
        onClick={handleAdd}
        disabled={disabled || !!selectionHint || added}
        className={`w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl font-semibold text-base transition-all tracking-wide ${
          selectionHint
            ? 'bg-amber-50 text-amber-700 border-2 border-amber-200 cursor-pointer'
            : disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : added
            ? 'bg-green-500 text-white'
            : isPreorder
            ? 'bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white shadow-lg shadow-orange-500/20'
            : 'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white shadow-lg shadow-green-600/20'
        }`}
        whileHover={!disabled && !selectionHint && !added ? { scale: 1.015 } : {}}
        whileTap={!disabled && !selectionHint ? { scale: 0.975 } : {}}
      >
        <AnimatePresence mode="wait">
          {added ? (
            <motion.span
              key="added"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              className="flex items-center gap-2"
            >
              <Check size={18} strokeWidth={2.5} />
              {isPreorder ? 'Pre-order Added!' : 'Added to Cart!'}
            </motion.span>
          ) : (
            <motion.span
              key="add"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              className="flex items-center gap-2"
            >
              {selectionHint ? (
                <>
                  <ShoppingCart size={18} />
                  {selectionHint}
                </>
              ) : disabled ? (
                isPreorder ? 'Pre-order Sold Out' : 'Out of Stock'
              ) : isPreorder ? (
                <>
                  <Clock size={18} />
                  Pre-order Now
                </>
              ) : (
                <>
                  <ShoppingCart size={18} />
                  Add to Cart
                </>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
