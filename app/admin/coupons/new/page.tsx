import type { Metadata } from 'next'
import CouponForm from '@/components/admin/CouponForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'New Coupon' }

export default function NewCouponPage() {
  return (
    <div className="max-w-xl">
      <Link href="/admin/coupons" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to Coupons
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Coupon</h1>
      <CouponForm />
    </div>
  )
}
