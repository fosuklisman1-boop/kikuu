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
      <label className="text-sm text-slate-500">Minimum withdrawal (GHS)</label>
      <input
        type="number"
        step="0.01"
        min={0}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
      />
      <button type="submit" disabled={pending} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">
        Save
      </button>
      {message && <span className="text-xs text-slate-500">{message}</span>}
    </form>
  )
}
