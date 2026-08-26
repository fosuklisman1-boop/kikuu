'use client'

import { useState, useTransition } from 'react'
import { updateMinWithdrawalAmount } from '@/lib/actions/withdrawals'

export default function MinAmountForm({ initialAmount }: { initialAmount: number }) {
  const [amount, setAmount] = useState(initialAmount)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    startTransition(async () => {
      const result = await updateMinWithdrawalAmount(amount)
      setMessage(result?.error ?? 'Saved.')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <label className="text-sm text-gray-400">Minimum withdrawal:</label>
      <input
        type="number"
        step="0.01"
        min={0}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm"
      />
      <button type="submit" disabled={pending} className="text-xs font-semibold text-green-600 disabled:text-gray-300">
        Save
      </button>
      {message && <span className="text-xs text-gray-500">{message}</span>}
    </form>
  )
}
