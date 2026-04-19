import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BrandForm from '@/components/admin/BrandForm'

export const metadata: Metadata = { title: 'Edit Brand' }

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const [{ data: brand }, { data: linked }, { data: allProducts }] = await Promise.all([
    admin.from('brands').select('*').eq('id', id).single(),
    admin.from('products').select('*').eq('brand_id', id).order('name'),
    admin.from('products').select('*').eq('status', 'active').order('name'),
  ])
  if (!brand) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Brand</h1>
      <BrandForm brand={brand} linkedProducts={linked ?? []} allProducts={allProducts ?? []} />
    </div>
  )
}
