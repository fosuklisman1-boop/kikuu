'use client'

import { useTransition } from 'react'
import { formatGHS } from '@/lib/utils'
import type { ShopProductPriced } from '@/lib/supabase/types'
import { removeShopProduct } from '@/lib/actions/shop-products'
import { SearchScope, SearchItem } from '@/components/ui/InstantSearch'

export default function ShopProductsTable({ items }: { items: ShopProductPriced[] }) {
  const [pending, startTransition] = useTransition()

  function handleRemove(id: string) {
    startTransition(async () => {
      await removeShopProduct(id)
    })
  }

  if (items.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">You haven&apos;t added any products yet.</p>
  }

  return (
    <SearchScope placeholder="Search your shop products…">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
          <th className="py-2 pr-4">Product</th>
          <th className="py-2 pr-4">Price</th>
          <th className="py-2 pr-4">Commission</th>
          <th className="py-2 pr-4">You earn / unit</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <SearchItem as="tr" key={item.id} text={`${item.product.name} ${item.product.slug}`} className="border-b border-gray-100">
            <td className="py-3 pr-4 font-medium text-gray-800">{item.product.name}</td>
            <td className="py-3 pr-4 text-gray-500">{formatGHS(item.shop_price)}</td>
            <td className="py-3 pr-4 text-gray-500">{item.commission_percent}%</td>
            <td className="py-3 pr-4 font-semibold text-gray-900">
              {formatGHS(Math.round(item.shop_price * item.commission_percent) / 100)}
            </td>
            <td className="py-3">
              <button
                onClick={() => handleRemove(item.id)}
                disabled={pending}
                className="text-red-500 hover:underline text-xs"
              >
                Remove
              </button>
            </td>
          </SearchItem>
        ))}
      </tbody>
    </table>
    </SearchScope>
  )
}
