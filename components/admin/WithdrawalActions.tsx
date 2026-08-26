'use client'

import { useState, useTransition } from 'react'
import { markWithdrawalPaid, rejectWithdrawal } from '@/lib/actions/withdrawals'

export default function WithdrawalActions({ requestId }: { requestId: string }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function handleMarkPaid() {
    setError('')
    startTransition(async () => {
      const result = await markWithdrawalPaid(requestId)
      if (result?.error) setError(result.error)
    })
  }

  function handleReject() {
    setError('')
    startTransition(async () => {
      const result = await rejectWithdrawal(requestId, reason)
      if (result?.error) setError(result.error)
      else setRejecting(false)
    })
  }

  if (rejecting) {
    return (
      <div className="flex items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
          className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-32"
        />
        <button onClick={handleReject} disabled={pending} className="text-xs font-semibold text-red-600">Confirm</button>
        <button onClick={() => setRejecting(false)} className="text-xs text-gray-400">Cancel</button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleMarkPaid} disabled={pending} className="text-xs font-semibold text-green-600 hover:underline">
        Mark Paid
      </button>
      <button onClick={() => setRejecting(true)} disabled={pending} className="text-xs font-semibold text-red-500 hover:underline">
        Reject
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
