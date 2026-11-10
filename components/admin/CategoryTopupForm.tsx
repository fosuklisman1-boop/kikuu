'use client'

import { useState, useTransition } from 'react'
import { updateCategoryTopup } from '@/lib/actions/categories'

export default function CategoryTopupForm({ id, initial }: { id: string; initial: number | null }) {
  const [value, setValue] = useState(initial === null ? '' : String(initial))
  const [msg, setMsg] = useState('')
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const res = await updateCategoryTopup(id, value)
      setMsg('error' in res && res.error ? res.error : 'Saved')
      setTimeout(() => setMsg(''), 2500)
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="0.00"
        aria-label="Below-minimum top-up per unit (GHS)"
        className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-green-500"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
      >
        {pending ? '...' : 'Save'}
      </button>
      {msg && <span className="text-[11px] text-gray-500">{msg}</span>}
    </div>
  )
}
