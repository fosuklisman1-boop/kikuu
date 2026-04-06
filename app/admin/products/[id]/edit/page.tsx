export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import ProductForm from '@/components/admin/ProductForm'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Edit Product' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params
  const admin = createAdminClient()

  const [{ data: product }, { data: categories }] = await Promise.all([
    admin.from('products').select('*').eq('id', id).single(),
    admin.from('categories').select('id, name, parent_id').order('name'),
  ])

  if (!product) notFound()

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Product</h1>
      <ProductForm categories={categories ?? []} product={product} />
    </div>
  )
}