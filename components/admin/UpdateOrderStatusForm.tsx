'use client'

import { updateOrderStatus } from '@/lib/actions/products'
import { useState } from 'react'

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']

export default function UpdateOrderStatusForm({
  orderId,
  currentStatus,
}: {
  orderId: string
  currentStatus: string
}) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)

  async function handleUpdate() {
    if (status === currentStatus) return
    setLoading(true)
    await updateOrderStatus(orderId, status)
    setLoading(false)
  }

  return (
    <div className="flex gap-2 items-center">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-500"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s} className="capitalize">{s}</option>
        ))}
      </select>
      <button
        onClick={handleUpdate}
        disabled={loading || status === currentStatus}
        className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Update'}
      </button>
    </div>
  )
}
