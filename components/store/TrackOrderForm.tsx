'use client'

import { useActionState } from 'react'
import { trackOrder, type TrackState } from '@/lib/actions/track-order'

export default function TrackOrderForm() {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrder, {})

  return (
    <form action={action} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <div>
        <label htmlFor="order_number" className="block text-xs font-semibold text-gray-600 mb-1.5">Order number</label>
        <input
          id="order_number" name="order_number" required autoComplete="off"
          placeholder="e.g. ORD-12345"
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#b45309]"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-xs font-semibold text-gray-600 mb-1.5">Phone number used for the order</label>
        <input
          id="phone" name="phone" type="tel" required inputMode="tel" autoComplete="tel"
          placeholder="024 123 4567"
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#b45309]"
        />
      </div>
      {state.error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{state.error}</p>}
      <button
        type="submit" disabled={pending}
        className="w-full py-3 rounded-xl text-sm font-bold bg-[#b45309] hover:bg-[#92400e] text-white disabled:opacity-60 transition-colors"
      >
        {pending ? 'Looking up…' : 'Track order'}
      </button>
    </form>
  )
}
