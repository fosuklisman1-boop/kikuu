export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'
import { DeliveryPill } from '@/components/admin/StatusPills'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

const RANGES = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
]

function pct(now: number, prev: number) {
  if (prev === 0) return now === 0 ? null : 100
  return Math.round(((now - prev) / prev) * 100)
}

function Delta({ now, prev }: { now: number; prev: number }) {
  const d = pct(now, prev)
  if (d === null) return <span className="text-xs text-slate-400">No change</span>
  const up = d >= 0
  return (
    <span className={`text-xs font-medium ${up ? 'text-emerald-700' : 'text-red-600'}`}>
      {up ? '+' : ''}{d}% vs previous {prev === 0 && now > 0 ? '(new)' : 'period'}
    </span>
  )
}

function ageLabel(iso: string) {
  const hrs = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
  if (hrs < 1) return 'under 1h'
  if (hrs < 48) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams
  const range = RANGES.find((r) => r.key === rangeParam) ?? RANGES[0]
  const admin = createAdminClient()

  const now = Date.now()
  const dayMs = 86400000
  const startCurrent = new Date(now - range.days * dayMs)
  const startPrevious = new Date(now - range.days * 2 * dayMs)

  const [
    { data: paidRows },
    { data: toShip, count: toShipCount },
    { data: lowStock, count: lowStockCount },
    { data: recent },
  ] = await Promise.all([
    admin
      .from('orders')
      .select('total, created_at')
      .eq('payment_status', 'paid')
      .gte('created_at', startPrevious.toISOString())
      .limit(5000),
    admin
      .from('orders')
      .select('id, order_number, buyer_name, total, created_at', { count: 'exact' })
      .eq('payment_status', 'paid')
      .eq('delivery_status', 'processing')
      .order('created_at', { ascending: true })
      .limit(5),
    admin
      .from('products')
      .select('id, name, stock_qty', { count: 'exact' })
      .eq('status', 'active')
      .lt('stock_qty', 5)
      .order('stock_qty', { ascending: true })
      .limit(5),
    admin
      .from('orders')
      .select('id, order_number, buyer_name, total, delivery_status, created_at')
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const current = (paidRows ?? []).filter((o) => new Date(o.created_at) >= startCurrent)
  const previous = (paidRows ?? []).filter((o) => new Date(o.created_at) < startCurrent)
  const sum = (rows: { total: number }[]) => rows.reduce((s, o) => s + Number(o.total), 0)
  const revenue = sum(current)
  const prevRevenue = sum(previous)
  const aov = current.length ? revenue / current.length : 0
  const prevAov = previous.length ? prevRevenue / previous.length : 0

  // Daily revenue for the chart (oldest -> newest).
  const buckets = Array.from({ length: range.days }, (_, i) => {
    const day = new Date(now - (range.days - 1 - i) * dayMs)
    return { key: day.toISOString().slice(0, 10), label: day.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' }), total: 0, count: 0 }
  })
  for (const o of current) {
    const b = buckets.find((x) => x.key === new Date(o.created_at).toISOString().slice(0, 10))
    if (b) { b.total += Number(o.total); b.count++ }
  }
  const max = Math.max(...buckets.map((b) => b.total), 1)

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Paid orders only.</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/admin?range=${r.key}`}
              aria-current={r.key === range.key ? 'true' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                r.key === range.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Needs action */}
      <section className={`mb-5 rounded-xl border px-5 py-4 ${(toShipCount ?? 0) > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {(toShipCount ?? 0) > 0
                ? `${toShipCount} paid order${toShipCount === 1 ? '' : 's'} waiting to ship`
                : 'Nothing waiting to ship'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {(toShipCount ?? 0) > 0 ? 'Oldest first. Open an order to move it to shipped.' : 'New paid orders will show up here.'}
            </p>
          </div>
          {(toShipCount ?? 0) > 0 && (
            <Link href="/admin/orders?tab=processing" className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800">
              View queue
            </Link>
          )}
        </div>
        {toShip && toShip.length > 0 && (
          <ul className="mt-3 divide-y divide-amber-200/70 rounded-lg bg-white/70">
            {toShip.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-white">
                  <span className="font-mono text-xs font-medium text-emerald-800">{o.order_number}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">{o.buyer_name}</span>
                  <span className="tabular-nums text-slate-900">{formatGHS(o.total)}</span>
                  <span className="w-16 text-right text-xs text-amber-800">{ageLabel(o.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* KPIs */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-sm text-slate-500">Revenue</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{formatGHS(revenue)}</p>
          <Delta now={revenue} prev={prevRevenue} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-sm text-slate-500">Paid orders</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{current.length}</p>
          <Delta now={current.length} prev={previous.length} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-sm text-slate-500">Average order</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{formatGHS(aov)}</p>
          <Delta now={aov} prev={prevAov} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5 min-w-0">
          {/* Revenue chart */}
          <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Daily revenue</h2>
            <div className="flex h-40 items-end gap-[3px]" role="img" aria-label={`Daily revenue for the last ${range.days} days`}>
              {buckets.map((b) => (
                <div key={b.key} className="group relative flex h-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t ${b.total > 0 ? 'bg-emerald-600 group-hover:bg-emerald-700' : 'bg-slate-100'}`}
                    style={{ height: `${b.total > 0 ? Math.max(4, (b.total / max) * 100) : 3}%` }}
                  />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
                    {b.label}: {formatGHS(b.total)} · {b.count} order{b.count === 1 ? '' : 's'}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>{buckets[0].label}</span>
              <span>{buckets[buckets.length - 1].label}</span>
            </div>
          </section>

          {/* Recent orders */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Recent paid orders</h2>
              <Link href="/admin/orders?tab=all" className="text-sm text-emerald-800 hover:underline">View all</Link>
            </div>
            {recent && recent.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {recent.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      <span className="font-mono text-xs font-medium text-emerald-800">{o.order_number}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-700">{o.buyer_name}</span>
                      <DeliveryPill status={o.delivery_status} />
                      <span className="w-24 text-right font-medium tabular-nums text-slate-900">{formatGHS(o.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-slate-500">No paid orders yet.</p>
            )}
          </section>
        </div>

        {/* Low stock */}
        <section className="h-fit rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Low stock</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${(lowStockCount ?? 0) > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
              {lowStockCount ?? 0}
            </span>
          </div>
          {lowStock && lowStock.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {lowStock.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}/edit`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                    <span className="min-w-0 flex-1 truncate text-slate-700">{p.name}</span>
                    <span className={`text-xs font-semibold tabular-nums ${p.stock_qty === 0 ? 'text-red-700' : 'text-amber-700'}`}>
                      {p.stock_qty === 0 ? 'Out' : `${p.stock_qty} left`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-slate-500">Every active product has 5 or more in stock.</p>
          )}
        </section>
      </div>
    </div>
  )
}
