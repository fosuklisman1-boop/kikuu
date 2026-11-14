'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { bulkUpdateDeliveryStatus } from '@/lib/actions/products'
import { DeliveryPill } from '@/components/admin/StatusPills'
import { formatGHS } from '@/lib/utils'

export interface OrderRow {
  id: string
  order_number: string
  buyer_name: string
  buyer_phone: string
  total: number
  payment_type: string
  payment_status: string
  delivery_status: string | null
  is_preorder: boolean
  created_at: string
}

const GATEWAY: Record<string, string> = { paystack: 'Paystack', theteller: 'Mobile Money', cod: 'Cash' }

function ago(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export default function OrdersTable({ rows }: { rows: OrderRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  const selectable = rows.filter((r) => r.payment_status === 'paid')
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.id)))
  }

  function apply(status: 'shipped' | 'delivered') {
    setMessage('')
    const ids = Array.from(selected)
    startTransition(async () => {
      const res = await bulkUpdateDeliveryStatus(ids, status)
      if ('error' in res && res.error) {
        setMessage(res.error)
        return
      }
      setSelected(new Set())
      setMessage(`${res.updated} order${res.updated === 1 ? '' : 's'} marked ${status}${res.failed ? `, ${res.failed} skipped` : ''}.`)
    })
  }

  if (!rows.length) {
    return <p className="py-16 text-center text-sm text-slate-500">No orders match these filters.</p>
  }

  return (
    <div>
      {(selected.size > 0 || message) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-emerald-50 px-4 py-2.5 text-sm">
          {selected.size > 0 ? (
            <>
              <span className="font-medium text-emerald-900">{selected.size} selected</span>
              <button
                onClick={() => apply('shipped')}
                disabled={pending}
                className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                Mark shipped
              </button>
              <button
                onClick={() => apply('delivered')}
                disabled={pending}
                className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-100 disabled:opacity-60"
              >
                Mark delivered
              </button>
              <button onClick={() => setSelected(new Set())} className="text-xs text-slate-600 hover:underline">
                Clear
              </button>
            </>
          ) : (
            <span className="text-emerald-900">{message}</span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs font-medium text-slate-500 border-b border-slate-200">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all orders on this page"
                  className="h-4 w-4 rounded border-slate-300 accent-emerald-700"
                />
              </th>
              <th className="px-3 py-3">Order</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-3 py-3">Paid with</th>
              <th className="px-3 py-3">Delivery</th>
              <th className="px-3 py-3">Placed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((o) => (
              <tr key={o.id} className={`hover:bg-slate-50/70 ${selected.has(o.id) ? 'bg-emerald-50/50' : ''}`}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={() => toggle(o.id)}
                    disabled={o.payment_status !== 'paid'}
                    aria-label={`Select order ${o.order_number}`}
                    className="h-4 w-4 rounded border-slate-300 accent-emerald-700 disabled:opacity-40"
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs font-medium text-emerald-800 hover:underline">
                    {o.order_number}
                  </Link>
                  {o.is_preorder && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Pre-order</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-900">{o.buyer_name}</p>
                  <p className="text-xs text-slate-500">{o.buyer_phone}</p>
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{formatGHS(o.total)}</td>
                <td className="px-3 py-3 text-slate-600">{GATEWAY[o.payment_type] ?? o.payment_type}</td>
                <td className="px-3 py-3">
                  {o.payment_status === 'refunded' ? (
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">Refunded</span>
                  ) : (
                    <DeliveryPill status={o.delivery_status} />
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-slate-500" title={new Date(o.created_at).toLocaleString('en-GH')}>
                  {ago(o.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
