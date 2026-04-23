export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchProductColors, fetchProductSizes } from '@/lib/actions/product-options'
import ProductForm from '@/components/admin/ProductForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Add Product' }

export default async function NewProductPage() {
  const admin = createAdminClient()
  const [{ data: categories }, allColors, allSizes] = await Promise.all([
    admin.from('categories').select('id, name, parent_id').order('name'),
    fetchProductColors(),
    fetchProductSizes(),
  ])

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Product</h1>
      <ProductForm categories={categories ?? []} allColors={allColors} allSizes={allSizes} />
    </div>
  )
}
