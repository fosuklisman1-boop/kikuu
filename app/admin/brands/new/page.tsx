import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import BrandForm from '@/components/admin/BrandForm'

export const metadata: Metadata = { title: 'New Brand' }

export default async function NewBrandPage() {
  const admin = createAdminClient()
  const { data: products } = await admin.from('products').select('*').eq('status', 'active').order('name')
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Brand</h1>
      <BrandForm allProducts={products ?? []} />
    </div>
  )
}
