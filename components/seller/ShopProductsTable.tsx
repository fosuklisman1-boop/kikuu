'use client'

import { useState, useTransition } from 'react'
import { formatGHS } from '@/lib/utils'
import type { ShopProductPriced } from '@/lib/supabase/types'
import { updateShopProductMarkup, removeShopProduct } from '@/lib/actions/shop-products'
import MarkupForm from './MarkupForm'

function EditableMarkupRow({
  item,
  onSave,
  onCancel,
}: {
  item: ShopProductPriced
  onSave: (markupType: 'flat' | 'percentage', markupValue: number) => void
  onCancel: () => void
}) {
  const [markupType, setMarkupType] = useState<'flat' | 'percentage'>(item.markup_type)
  const [markupValue, setMarkupValue] = useState(item.markup_value)

  return (
    <div className="flex items-center gap-2">
      <MarkupForm
        basePrice={item.base_price}
        initialMarkupType={item.markup_type}
        initialMarkupValue={item.markup_value}
        onChange={(t, v) => { setMarkupType(t); setMarkupValue(v) }}
      />
      <button onClick={() => onSave(markupType, markupValue)} className="text-green-600 text-xs font-semibold">
        Save
      </button>
      <button onClick={onCancel} className="text-gray-400 text-xs">
        Cancel
      </button>
    </div>
  )
}

export default function ShopProductsTable({ items }: { items: ShopProductPriced[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSave(item: ShopProductPriced, markupType: 'flat' | 'percentage', markupValue: number) {
    startTransition(async () => {
      await updateShopProductMarkup(item.id, markupType, markupValue)
      setEditingId(null)
    })
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      await removeShopProduct(id)
    })
  }

  if (items.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">You haven&apos;t added any products yet.</p>
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
          <th className="py-2 pr-4">Product</th>
          <th className="py-2 pr-4">Base price</th>
          <th className="py-2 pr-4">Markup</th>
          <th className="py-2 pr-4">Your price</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="border-b border-gray-100">
            <td className="py-3 pr-4 font-medium text-gray-800">{item.product.name}</td>
            <td className="py-3 pr-4 text-gray-500">{formatGHS(item.base_price)}</td>
            <td className="py-3 pr-4">
              {editingId === item.id ? (
                <EditableMarkupRow
                  item={item}
                  onSave={(markupType, markupValue) => handleSave(item, markupType, markupValue)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <button onClick={() => setEditingId(item.id)} className="text-green-600 hover:underline">
                  {item.markup_type === 'flat' ? `+${formatGHS(item.markup_value)}` : `+${item.markup_value}%`}
                </button>
              )}
            </td>
            <td className="py-3 pr-4 font-semibold text-gray-900">{formatGHS(item.shop_price)}</td>
            <td className="py-3">
              <button
                onClick={() => handleRemove(item.id)}
                disabled={pending}
                className="text-red-500 hover:underline text-xs"
              >
                Remove
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
