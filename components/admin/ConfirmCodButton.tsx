'use client'

import { confirmCodPayment } from '@/lib/actions/products'
import { useState } from 'react'

export default function ConfirmCodButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (!confirm('Confirm that cash has been collected for this order?')) return
    setLoading(true)
    const result = await confirmCodPayment(orderId)
    if (result?.error) alert(result.error)
    setLoading(false)
  }

  return (
    <button
      onClick={handleConfirm}
      disabled={loading}
      className="text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50"
    >
      {loading ? 'Confirming...' : 'Confirm Cash Collected'}
    </button>
  )
}
