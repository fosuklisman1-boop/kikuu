import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import FlashSaleForm from '@/components/admin/FlashSaleForm'
import type { FlashSaleWithItems } from '@/lib/supabase/types'

export const metadata: Metadata = { title: 'Edit Flash Sale' }

export default async function EditFlashSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const [{ data: sale }, { data: products }] = await Promise.all([
    admin.from('flash_sales').select('*, items:flash_sale_items(*, product:products(*))').eq('id', id).single(),
    admin.from('products').select('*').eq('status', 'active').order('name'),
  ])
  if (!sale) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Flash Sale</h1>
      <FlashSaleForm sale={sale as unknown as FlashSaleWithItems} allProducts={products ?? []} />
    </div>
  )
}
