'use client'

import { useState, useTransition } from 'react'
import { Store } from 'lucide-react'
import { addShopProducts } from '@/lib/actions/shop-products'
import MarkupForm from '@/components/seller/MarkupForm'

export default function AddToShopButton({ productId, basePrice }: { productId: string; basePrice: number }) {
  const [open, setOpen] = useState(false)
  const [markupType, setMarkupType] = useState<'flat' | 'percentage'>('flat')
  const [markupValue, setMarkupValue] = useState(0)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMessage('')
    startTransition(async () => {
      const result = await addShopProducts({ productIds: [productId], markupType, markupValue })
      if (result.error) {
        setMessage(result.error)
      } else {
        setMessage('Added to your shop!')
        setTimeout(() => { setOpen(false); setMessage('') }, 1500)
      }
    })
  }

  return (
    <div className="relative" onClick={(e) => e.preventDefault()}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v) }}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow-sm text-[#6b6360] hover:text-[#b45309] transition-colors"
        aria-label="Add to my shop"
        title="Add to my shop"
      >
        <Store size={15} />
      </button>

      {open && (
        <div
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-30"
        >
          <p className="text-xs font-semibold text-gray-700 mb-2">Add to my shop</p>
          <MarkupForm
            basePrice={basePrice}
            initialMarkupType={markupType}
            initialMarkupValue={markupValue}
            onChange={(type, value) => { setMarkupType(type); setMarkupValue(value) }}
          />
          <button
            onClick={handleAdd}
            disabled={pending}
            className="mt-2 w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
          >
            {pending ? 'Adding…' : 'Add'}
          </button>
          {message && <p className="mt-2 text-xs text-gray-600">{message}</p>}
        </div>
      )}
    </div>
  )
}
