export const dynamic = 'force-dynamic'
import { fetchProductColors, fetchProductSizes } from '@/lib/actions/product-options'
import ProductOptionsManager from '@/components/admin/ProductOptionsManager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Product Options' }

export default async function ProductOptionsPage() {
  const [colors, sizes] = await Promise.all([
    fetchProductColors(),
    fetchProductSizes(),
  ])

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Product Options</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage the global pool of colors and sizes available for products.
        </p>
      </div>
      <ProductOptionsManager initialColors={colors} initialSizes={sizes} />
    </div>
  )
}
