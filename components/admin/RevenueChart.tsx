'use client'

import { useRef, useState } from 'react'
import { formatGHS } from '@/lib/utils'

export interface RevenueBucket {
  key: string
  label: string
  total: number
  count: number
}

// Hover tooltips don't exist on touch screens, so the breakdown for the
// selected bar is also shown in a fixed readout under the chart. Selection works
// by pointer position over the whole chart (bars are only a few px wide on a
// phone, so tapping/dragging anywhere along the chart picks the nearest bar).
export default function RevenueChart({ buckets, days }: { buckets: RevenueBucket[]; days: number }) {
  const [selected, setSelected] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const max = Math.max(...buckets.map((b) => b.total), 1)

  function pick(clientX: number) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    const i = Math.min(buckets.length - 1, Math.max(0, Math.floor(ratio * buckets.length)))
    setSelected(i)
  }

  const sel = selected !== null ? buckets[selected] : null

  return (
    <div>
      <div
        ref={ref}
        className="flex h-40 items-end gap-[3px] cursor-pointer select-none"
        style={{ touchAction: 'pan-y' }}
        role="img"
        aria-label={`Daily revenue for the last ${days} days. Tap a bar for details.`}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => { if (e.pointerType !== 'mouse' || e.buttons === 1) pick(e.clientX) }}
      >
        {buckets.map((b, i) => {
          const active = i === selected
          return (
            <div key={b.key} className="group relative flex h-full flex-1 items-end">
              <div
                className={`w-full rounded-t ${
                  b.total > 0
                    ? active ? 'bg-emerald-800' : 'bg-emerald-600 group-hover:bg-emerald-700'
                    : active ? 'bg-slate-300' : 'bg-slate-100'
                }`}
                style={{ height: `${b.total > 0 ? Math.max(4, (b.total / max) * 100) : 3}%` }}
              />
              {/* Desktop hover tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white md:group-hover:block">
                {b.label}: {formatGHS(b.total)} · {b.count} order{b.count === 1 ? '' : 's'}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex justify-between text-xs text-slate-400">
        <span>{buckets[0].label}</span>
        <span>{buckets[buckets.length - 1].label}</span>
      </div>

      <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm min-h-[44px] flex items-center" aria-live="polite">
        {sel ? (
          <div className="flex w-full items-center justify-between gap-3">
            <span className="font-medium text-slate-900">{sel.label}</span>
            <span className="tabular-nums text-slate-700">
              {formatGHS(sel.total)} · {sel.count} order{sel.count === 1 ? '' : 's'}
            </span>
          </div>
        ) : (
          <span className="text-slate-400">Tap a bar to see that day&apos;s revenue and orders.</span>
        )}
      </div>
    </div>
  )
}
