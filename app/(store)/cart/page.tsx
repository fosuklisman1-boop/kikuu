'use client'

import { useCart } from '@/lib/cart'
import { formatGHS } from '@/lib/utils'
import Link from 'next/link'
import CartItem from '@/components/store/CartItem'
import { ShoppingBag, ArrowRight, Clock } from 'lucide-react'
import { useEffect } from 'react'

export default function CartPage() {
  const { items, total, hasPreorderItems, _hasHydrated, removeItem } = useCart()

  // Flush qty=0 items when the cart page is closed/navigated away from
  useEffect(() => {
    return () => {
      const state = useCart.getState()
      for (const item of state.items) {
        if (item.quantity === 0) state.removeItem(item.id)
      }
    }
  }, [])

  if (!_hasHydrated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="h-7 bg-[#ebe8e3] rounded-lg w-40 mb-8 shimmer" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#ede9e4] p-4 flex gap-4">
                <div className="w-20 h-20 bg-[#f0ede8] rounded-xl shrink-0 shimmer" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3.5 bg-[#f0ede8] rounded w-3/4 shimmer" />
                  <div className="h-3 bg-[#f0ede8] rounded w-1/3 shimmer" />
                  <div className="h-8 bg-[#f0ede8] rounded-xl w-28 mt-3 shimmer" />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-[#ede9e4] p-5 h-fit space-y-3">
            <div className="h-4 bg-[#f0ede8] rounded w-1/2 shimmer" />
            <div className="h-12 bg-[#f0ede8] rounded-xl shimmer" />
            <div className="h-12 bg-[#f0ede8] rounded-xl shimmer" />
          </div>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-28 text-center">
        <div className="w-20 h-20 bg-[#fdf6ec] rounded-3xl flex items-center justify-center mx-auto mb-6">
          <ShoppingBag size={32} className="text-[#b45309]" />
        </div>
        <h1 className="text-2xl font-bold text-[#0a0a0a] mb-2">Your cart is empty</h1>
        <p className="text-[#6b6360] text-sm mb-8">Looks like you haven't added anything yet.</p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 bg-[#b45309] hover:bg-[#92400e] text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors shadow-sm"
        >
          Start Shopping
          <ArrowRight size={15} />
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950">Shopping Cart</h1>
          <p className="text-sm text-gray-400 mt-0.5">{items.filter(i => i.quantity > 0).length} item{items.filter(i => i.quantity > 0).length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/products" className="text-sm text-[#b45309] hover:text-[#92400e] font-medium transition-colors">
          + Add more
        </Link>
      </div>

      {/* Pre-order notice */}
      {hasPreorderItems && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 mb-5">
          <Clock size={15} className="text-orange-500 shrink-0 mt-0.5" />
          <p className="text-sm text-orange-800">
            <span className="font-semibold">Pre-order in cart.</span>{' '}
            <span className="text-orange-700">Your order will be paid on delivery when it ships.</span>
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <CartItem key={item.id} item={item} />
          ))}
        </div>

        {/* Summary */}
        <div className="h-fit space-y-3">
          <div className="bg-white rounded-2xl border border-[#ede9e4] p-5 shadow-sm">
            <h2 className="font-semibold text-gray-950 mb-4 text-sm tracking-wide">Order Summary</h2>

            <div className="space-y-2.5 text-sm mb-4">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</span>
                <span className="font-medium text-gray-900">{formatGHS(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Delivery</span>
                <span className="text-gray-400 text-xs">At checkout</span>
              </div>
            </div>

            <div className="border-t border-[#f0ede8] pt-3.5 flex justify-between items-center mb-5">
              <span className="font-semibold text-gray-950 text-sm">Subtotal</span>
              <span className="font-bold text-gray-950 text-lg">{formatGHS(total)}</span>
            </div>

            <Link
              href="/checkout"
              className="shine-on-hover flex items-center justify-center gap-2 w-full bg-[#b45309] hover:bg-[#92400e] text-white py-3.5 rounded-xl font-semibold text-sm transition-colors shadow-sm"
            >
              Proceed to Checkout
              <ArrowRight size={15} />
            </Link>
          </div>

          <p className="text-center text-xs text-gray-400 px-2">
            Secure checkout by Paystack · MTN MoMo · Visa / MC
          </p>
        </div>
      </div>
    </div>
  )
}
