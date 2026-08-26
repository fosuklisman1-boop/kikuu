'use client'

import { useState, useTransition } from 'react'
import { adjustWalletBalance } from '@/lib/actions/withdrawals'

export default function ManualAdjustmentForm() {
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setMessage('')
    startTransition(async () => {
      const result = await adjustWalletBalance(
        String(formData.get('shop_slug')),
        formData.get('type') as 'credit' | 'debit',
        Number(formData.get('amount')),
        String(formData.get('reason'))
      )
      if (result?.error) setMessage(result.error)
      else setMessage('Adjustment applied.')
    })
  }

  return (
    <form action={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 max-w-md space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Manual Wallet Adjustment</h3>
      <input name="shop_slug" placeholder="Shop URL slug" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      <div className="flex gap-3">
        <select name="type" className="border border-gray-300 rounded-xl px-3 py-2 text-sm">
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
        <input name="amount" type="number" step="0.01" placeholder="Amount" className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      </div>
      <input name="reason" placeholder="Reason (required)" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      {message && <p className="text-xs text-gray-600">{message}</p>}
      <button type="submit" disabled={pending} className="text-sm font-semibold text-green-600 disabled:text-gray-300">
        Apply Adjustment
      </button>
    </form>
  )
}
