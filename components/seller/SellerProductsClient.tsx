'use client'

import { useState } from 'react'
import ShopProductPicker from './ShopProductPicker'
import ShopProductsTable from './ShopProductsTable'
import type { Product, ShopProductPriced } from '@/lib/supabase/types'

export default function SellerProductsClient({
  availableProducts,
  curatedItems,
}: {
  availableProducts: Product[]
  curatedItems: ShopProductPriced[]
}) {
  const [tab, setTab] = useState<'browse' | 'manage'>('manage')

  return (
    <div>
      <div className="flex gap-2 mb-5 border-b border-gray-200">
        <button
          onClick={() => setTab('manage')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'manage' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'
          }`}
        >
          My Shop ({curatedItems.length})
        </button>
        <button
          onClick={() => setTab('browse')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'browse' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'
          }`}
        >
          Browse Catalog ({availableProducts.length})
        </button>
      </div>
      {tab === 'manage' ? <ShopProductsTable items={curatedItems} /> : <ShopProductPicker products={availableProducts} />}
    </div>
  )
}
