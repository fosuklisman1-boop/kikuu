'use client'

import { useState } from 'react'
import { updateDeliveryFee } from '@/lib/actions/delivery'

interface Props {
  region: string
  fee: number
  enabled: boolean
}

export default function DeliveryFeeForm({ region, fee: initialFee, enabled: initialEnabled }: Props) {
  const [fee, setFee] = useState(String(initialFee))
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    const parsed = parseFloat(fee)
    if (isNaN(parsed) || parsed < 0) return
    setSaving(true)
    await updateDeliveryFee(region, parsed, enabled)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="grid grid-cols-[1fr_120px_80px_80px] items-center px-5 py-3 hover:bg-gray-50 transition-colors">
      <span className="text-sm font-medium text-gray-800">{region}</span>

      <input
        type="number"
        min="0"
        step="0.50"
        value={fee}
        onChange={(e) => { setFee(e.target.value); setSaved(false) }}
        className="w-24 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-100"
      />

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => { setEnabled((v) => !v); setSaved(false) }}
          className={`w-10 h-5 rounded-full transition-colors relative ${enabled ? 'bg-green-500' : 'bg-gray-200'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? 'left-5' : 'left-0.5'}`} />
        </button>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            saved
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-700 hover:bg-green-600 hover:text-white'
          } disabled:opacity-50`}
        >
          {saving ? '...' : saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}
