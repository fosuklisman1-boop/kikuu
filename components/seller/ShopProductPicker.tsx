'use client'

import { useState, useTransition } from 'react'
import { formatGHS } from '@/lib/utils'
import type { Product } from '@/lib/supabase/types'
import { addShopProducts } from '@/lib/actions/shop-products'
import MarkupForm from './MarkupForm'

export default function ShopProductPicker({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [markupType, setMarkupType] = useState<'flat' | 'percentage'>('flat')
  const [markupValue, setMarkupValue] = useState(0)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleApply() {
    setMessage('')
    const count = selected.size
    startTransition(async () => {
      const result = await addShopProducts({
        productIds: Array.from(selected),
        markupType,
        markupValue,
      })
      if (result.error) {
        setMessage(result.error)
      } else {
        setMessage(`Added ${count} product${count === 1 ? '' : 's'} to your shop.`)
        setSelected(new Set())
      }
    })
  }

  const avgBasePrice = selected.size
    ? products.filter((p) => selected.has(p.id)).reduce((s, p) => s + p.price, 0) / selected.size
    : 0

  if (products.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No more products to add — you&apos;ve curated the whole catalog.</p>
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {products.map((product) => (
          <label
            key={product.id}
            className={`relative border rounded-xl p-3 cursor-pointer transition-colors ${
              selected.has(product.id) ? 'border-green-600 bg-green-50' : 'border-gray-200'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(product.id)}
              onChange={() => toggle(product.id)}
              className="absolute top-2 right-2 w-4 h-4"
            />
            <div className="aspect-square bg-gray-50 rounded-lg mb-2 overflow-hidden">
              {product.images[0] && (
                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
              )}
            </div>
            <p className="text-xs font-medium text-gray-800 line-clamp-2">{product.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{formatGHS(product.price)}</p>
          </label>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-60 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] p-4 flex flex-wrap items-center gap-3 z-30">
          <span className="text-sm font-medium text-gray-700">{selected.size} selected</span>
          <MarkupForm
            basePrice={avgBasePrice}
            initialMarkupType={markupType}
            initialMarkupValue={markupValue}
            onChange={(type, value) => { setMarkupType(type); setMarkupValue(value) }}
          />
          <button
            onClick={handleApply}
            disabled={pending}
            className="ml-auto bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            {pending ? 'Applying…' : `Apply to ${selected.size} product${selected.size === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  )
}
