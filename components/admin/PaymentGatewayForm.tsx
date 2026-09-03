'use client'

import { useState, useTransition } from 'react'
import { updatePaymentGatewaySettings } from '@/lib/actions/payment-settings'

export default function PaymentGatewayForm({
  initialPaystackEnabled,
  initialTellerEnabled,
}: {
  initialPaystackEnabled: boolean
  initialTellerEnabled: boolean
}) {
  const [paystackEnabled, setPaystackEnabled] = useState(initialPaystackEnabled)
  const [tellerEnabled, setTellerEnabled] = useState(initialTellerEnabled)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  function handleSubmit(formData: FormData) {
    setMessage('')
    startTransition(async () => {
      const result = await updatePaymentGatewaySettings(formData)
      setMessage(result.error ?? 'Saved.')
    })
  }

  return (
    <form action={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 max-w-md space-y-4">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="paystack_enabled"
          checked={paystackEnabled}
          onChange={(e) => setPaystackEnabled(e.target.checked)}
          className="w-4 h-4"
        />
        <span className="text-sm font-medium text-gray-700">Paystack (Card, Bank, MoMo)</span>
      </label>
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="theteller_enabled"
          checked={tellerEnabled}
          onChange={(e) => setTellerEnabled(e.target.checked)}
          className="w-4 h-4"
        />
        <span className="text-sm font-medium text-gray-700">TheTeller (Mobile Money)</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </form>
  )
}
