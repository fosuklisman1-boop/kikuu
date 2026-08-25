'use client'

import { useState, useEffect } from 'react'
import { formatGHS } from '@/lib/utils'
import { computeShopPrice } from '@/lib/shop-pricing'

interface Props {
  basePrice: number
  initialMarkupType?: 'flat' | 'percentage'
  initialMarkupValue?: number
  onChange: (markupType: 'flat' | 'percentage', markupValue: number) => void
}

export default function MarkupForm({
  basePrice,
  initialMarkupType = 'flat',
  initialMarkupValue = 0,
  onChange,
}: Props) {
  const [markupType, setMarkupType] = useState<'flat' | 'percentage'>(initialMarkupType)
  const [markupValue, setMarkupValue] = useState(initialMarkupValue)

  useEffect(() => {
    onChange(markupType, markupValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markupType, markupValue])

  const preview = computeShopPrice(basePrice, markupType, markupValue)

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs font-medium">
        <button
          type="button"
          onClick={() => setMarkupType('flat')}
          className={`px-2.5 py-1.5 ${markupType === 'flat' ? 'bg-green-600 text-white' : 'bg-white text-gray-600'}`}
        >
          GHS
        </button>
        <button
          type="button"
          onClick={() => setMarkupType('percentage')}
          className={`px-2.5 py-1.5 ${markupType === 'percentage' ? 'bg-green-600 text-white' : 'bg-white text-gray-600'}`}
        >
          %
        </button>
      </div>
      <input
        type="number"
        min={0}
        step="0.01"
        value={markupValue}
        onChange={(e) => setMarkupValue(Math.max(0, Number(e.target.value)))}
        className="w-24 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm"
      />
      <span className="text-xs text-gray-500 whitespace-nowrap">→ {formatGHS(preview)}</span>
    </div>
  )
}
