'use client'

import { useState } from 'react'
import Link from 'next/link'
import { deleteCoupon, toggleCoupon } from '@/lib/actions/coupons'
import { Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

export default function CouponRowActions({ id, active }: { id: string; active: boolean }) {
  const [busy, setBusy] = useState(false)

  async function handleToggle() {
    setBusy(true)
    await toggleCoupon(id, !active)
    setBusy(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this coupon? This cannot be undone.')) return
    setBusy(true)
    await deleteCoupon(id)
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={handleToggle}
        disabled={busy}
        title={active ? 'Deactivate' : 'Activate'}
        className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
      >
        {active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
      </button>
      <Link
        href={`/admin/coupons/${id}`}
        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
      >
        <Pencil size={15} />
      </Link>
      <button
        onClick={handleDelete}
        disabled={busy}
        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}
