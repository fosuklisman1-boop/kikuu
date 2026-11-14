'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { updateDeliveryStatus } from '@/lib/actions/products'
import { DELIVERY_STEPS, DELIVERY_LABELS, type DeliveryStatus } from '@/lib/order-status'

// The one-click delivery rail: click a step to move the order there. Disabled
// unless the order is paid.
export default function DeliveryStepper({
  orderId,
  current,
  disabled,
}: {
  orderId: string
  current: DeliveryStatus | null
  disabled?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const currentIndex = current ? DELIVERY_STEPS.indexOf(current) : -1

  function go(step: DeliveryStatus) {
    if (disabled || pending || step === current) return
    setError('')
    startTransition(async () => {
      const res = await updateDeliveryStatus(orderId, step)
      if (res && 'error' in res && res.error) setError(res.error)
    })
  }

  return (
    <div>
      <ol className="flex items-start" aria-label="Delivery progress">
        {DELIVERY_STEPS.map((step, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          return (
            <li key={step} className="flex-1 flex flex-col items-center relative">
              {i > 0 && (
                <span
                  className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${i <= currentIndex ? 'bg-emerald-600' : 'bg-slate-200'}`}
                />
              )}
              <button
                type="button"
                onClick={() => go(step)}
                disabled={disabled || pending}
                aria-current={active ? 'step' : undefined}
                className={`relative z-10 h-8 w-8 rounded-full grid place-items-center text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed ${
                  done || active
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-400 ring-2 ring-slate-200 hover:ring-emerald-400 hover:text-emerald-700'
                }`}
              >
                {pending && !done && !active ? <Loader2 size={14} className="animate-spin" /> : done ? <Check size={14} /> : i + 1}
              </button>
              <span className={`mt-2 text-xs font-medium ${active ? 'text-emerald-800' : done ? 'text-slate-600' : 'text-slate-400'}`}>
                {DELIVERY_LABELS[step]}
              </span>
            </li>
          )
        })}
      </ol>
      {disabled && <p className="mt-3 text-xs text-slate-500 text-center">Delivery can be updated once the order is paid.</p>}
      {error && <p className="mt-3 text-xs text-red-600 text-center" role="alert">{error}</p>}
    </div>
  )
}
