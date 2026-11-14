'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

const POLL_MS = 4000
const GIVE_UP_MS = 3 * 60 * 1000

// Shown after a direct mobile money charge: polls until the customer approves
// (reloads onto the success banner), the payment fails, or we stop waiting.
export default function AwaitingMomoApproval({ orderId }: { orderId: string }) {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let stopped = false
    const started = Date.now()

    async function poll() {
      if (stopped) return
      try {
        const res = await fetch(`/api/payment/theteller-status?order_id=${orderId}`, { cache: 'no-store' })
        const data = await res.json()
        if (data.state === 'paid') {
          window.location.href = `/orders/${orderId}?success=1`
          return
        }
        if (data.state === 'failed') {
          setMessage(data.reason ?? 'The payment was declined or cancelled.')
          return
        }
      } catch {
        // transient network error — keep polling
      }
      if (Date.now() - started > GIVE_UP_MS) {
        setMessage('We have not received your approval yet. If you approved the prompt, your order will update automatically within a few minutes.')
        return
      }
      setTimeout(poll, POLL_MS)
    }

    poll()
    return () => { stopped = true }
  }, [orderId])

  if (message) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6">
        <p className="font-bold text-amber-900 text-sm">Payment not completed</p>
        <p className="text-xs text-amber-800 mt-0.5">{message}</p>
      </div>
    )
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
      <Loader2 size={20} className="animate-spin text-blue-600 mt-0.5 shrink-0" />
      <div>
        <p className="font-bold text-blue-900 text-sm">Approve the payment on your phone</p>
        <p className="text-xs text-blue-800 mt-0.5">
          Enter your mobile money PIN when the prompt appears. This page updates automatically once payment is confirmed.
        </p>
      </div>
    </div>
  )
}
