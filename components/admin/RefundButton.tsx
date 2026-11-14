'use client'

import { useState, useTransition } from 'react'
import { refundOrder } from '@/lib/actions/products'

export default function RefundButton({ orderId, total }: { orderId: string; total: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function refund() {
    setError('')
    startTransition(async () => {
      const res = await refundOrder(orderId)
      if (res && 'error' in res && res.error) setError(res.error)
      else setConfirming(false)
    })
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-red-700 hover:text-red-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 rounded"
      >
        Refund order
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm" role="alertdialog" aria-label="Confirm refund">
      <p className="text-red-900 font-medium">Refund {total}?</p>
      <p className="text-red-800/80 text-xs mt-1">
        Marks the order as refunded and reverses any seller earnings. Send the money back to the customer separately.
      </p>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={refund}
          disabled={pending}
          className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60"
        >
          {pending ? 'Refunding…' : 'Yes, refund'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-700 mt-2" role="alert">{error}</p>}
    </div>
  )
}
