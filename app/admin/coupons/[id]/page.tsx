export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import CouponForm from '@/components/admin/CouponForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'Edit Coupon' }

export default async function EditCouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const { data: coupon } = await admin.from('coupons').select('*').eq('id', id).single()
  if (!coupon) notFound()

  return (
    <div className="max-w-xl">
      <Link href="/admin/coupons" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to Coupons
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Coupon</h1>
      <CouponForm coupon={coupon} />
    </div>
  )
}
