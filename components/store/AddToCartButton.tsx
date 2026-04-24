'use client'

import { useCart } from '@/lib/cart'
import type { Product } from '@/lib/supabase/types'
import { ShoppingCart, Check, Clock } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AddToCartButton({
  product,
  disabled,
  salePrice,
  selectedColor,
  selectedSize,
}: {
  product: Product
  disabled?: boolean
  salePrice?: number
  selectedColor?: { name: string; hex: string }
  selectedSize?: string
}) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const [cartError, setCartError] = useState('')
  const isPreorder = product.status === 'pre_order'

  function handleAdd() {
    const itemToAdd = salePrice !== undefined && salePrice < product.price
      ? { ...product, price: salePrice }
      : product
    const result = addItem(itemToAdd, 1, selectedColor, selectedSize)
    if (result?.error) {
      setCartError(result.error)
      setTimeout(() => setCartError(''), 5000)
      return
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="space-y-2">
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
        disabled={disabled || added}
        className={`w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl font-semibold text-base transition-all tracking-wide ${
          disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : added
            ? 'bg-green-500 text-white'
            : isPreorder
            ? 'bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white shadow-lg shadow-orange-500/20'
            : 'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white shadow-lg shadow-green-600/20'
        }`}
        whileHover={!disabled && !added ? { scale: 1.015 } : {}}
        whileTap={!disabled ? { scale: 0.975 } : {}}
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
              {disabled ? (
                'Out of Stock'
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
