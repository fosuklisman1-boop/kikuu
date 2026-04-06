export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import ProductForm from '@/components/admin/ProductForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Add Product' }

export default async function NewProductPage() {
  const admin = createAdminClient()
  const { data: categories } = await admin
    .from('categories')
    .select('id, name, parent_id')
    .order('name')

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Product</h1>
      <ProductForm categories={categories ?? []} />
    </div>
  )
}