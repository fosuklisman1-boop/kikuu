'use client'

import { useState, useTransition } from 'react'
import { updateDefaultCommissionPercent } from '@/lib/actions/commission'

export default function CommissionSettingsForm({ initialPercent }: { initialPercent: number }) {
  const [percent, setPercent] = useState(String(initialPercent))
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    startTransition(async () => {
      const result = await updateDefaultCommissionPercent(Number(percent))
      setMessage(result.error ?? 'Saved.')
    })
  }

  return (
    <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Default seller commission (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-600"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      <p className="text-xs text-gray-400 basis-full">
        Sellers earn this percent of each sale. A product can override it in its edit form. Applies to new orders only.
      </p>
      {message && <p className="text-xs text-gray-600 basis-full">{message}</p>}
    </form>
  )
}
