import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import FlashSaleForm from '@/components/admin/FlashSaleForm'

export const metadata: Metadata = { title: 'New Flash Sale' }

export default async function NewFlashSalePage() {
  const admin = createAdminClient()
  const { data: products } = await admin
    .from('products')
    .select('*')
    .in('status', ['active', 'pre_order'])
    .order('name')

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-6">New Flash Sale</h1>
      <FlashSaleForm allProducts={products ?? []} />
    </div>
  )
}
