export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Search } from 'lucide-react'
import OrdersTable, { type OrderRow } from '@/components/admin/OrdersTable'

export const metadata: Metadata = { title: 'Orders' }

const PAGE_SIZE = 20

const TABS = [
  { key: 'processing', label: 'To ship' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'refunded', label: 'Refunded' },
  { key: 'all', label: 'All paid' },
] as const
type TabKey = (typeof TABS)[number]['key']

const RANGES = [
  { key: 'all', label: 'Any time', days: 0 },
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
]

interface Props {
  searchParams: Promise<{ tab?: string; q?: string; range?: string; preorder?: string; page?: string }>
}

export default async function AdminOrdersPage({ searchParams }: Props) {
  const params = await searchParams
  const tab: TabKey = TABS.some((t) => t.key === params.tab) ? (params.tab as TabKey) : 'processing'
  // Strip characters that would break the PostgREST or() filter or act as wildcards.
  const q = (params.q ?? '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 60)
  const range = RANGES.find((r) => r.key === params.range) ?? RANGES[0]
  const preorderOnly = params.preorder === '1'
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE

  const admin = createAdminClient()
  const since = range.days ? new Date(Date.now() - range.days * 86400000).toISOString() : null

  // Filters other than the tab are shared by the list and the tab counts.
  function scoped(query: any) {
    let qy = query
    if (q) {
      qy = qy.or(`order_number.ilike.%${q}%,buyer_name.ilike.%${q}%,buyer_phone.ilike.%${q}%,buyer_email.ilike.%${q}%`)
    }
    if (since) qy = qy.gte('created_at', since)
    if (preorderOnly) qy = qy.eq('is_preorder', true)
    return qy
  }
  // Admin only ever sees paid (or refunded) orders.
  function tabFilter(query: any, key: TabKey) {
    if (key === 'refunded') return query.eq('payment_status', 'refunded')
    const paid = query.eq('payment_status', 'paid')
    return key === 'all' ? paid : paid.eq('delivery_status', key)
  }

  const [list, ...counts] = await Promise.all([
    tabFilter(
      scoped(
        admin
          .from('orders')
          .select('id, order_number, buyer_name, buyer_phone, total, payment_type, payment_status, delivery_status, is_preorder, created_at', { count: 'exact' })
      ),
      tab
    )
      .order('created_at', { ascending: tab === 'processing' }) // oldest unshipped first
      .range(from, from + PAGE_SIZE - 1),
    ...TABS.map((t) => tabFilter(scoped(admin.from('orders').select('id', { count: 'exact', head: true })), t.key)),
  ])

  const rows = (list.data ?? []) as OrderRow[]
  const total = list.count ?? 0
  const tabCounts = Object.fromEntries(TABS.map((t, i) => [t.key, counts[i].count ?? 0])) as Record<TabKey, number>

  const qs = (over: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = {
      tab,
      q: q || undefined,
      range: range.key === 'all' ? undefined : range.key,
      preorder: preorderOnly ? '1' : undefined,
      ...over,
    }
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v)
    const s = sp.toString()
    return s ? `/admin/orders?${s}` : '/admin/orders'
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Orders</h1>
        <p className="text-sm text-slate-500 mt-1">Paid orders only. Unpaid and failed payments never reach this list.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2 pt-2" role="tablist">
          {TABS.map((t) => {
            const active = t.key === tab
            return (
              <Link
                key={t.key}
                href={qs({ tab: t.key, page: undefined })}
                role="tab"
                aria-selected={active}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors ${
                  active ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                    t.key === 'processing' && tabCounts.processing > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tabCounts[t.key]}
                </span>
              </Link>
            )
          })}
        </div>

        <form action="/admin/orders" method="get" className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <input type="hidden" name="tab" value={tab} />
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search order number, name, phone or email"
              aria-label="Search orders"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>
          <select
            name="range"
            defaultValue={range.key}
            aria-label="Date range"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="preorder" value="1" defaultChecked={preorderOnly} className="h-4 w-4 rounded accent-emerald-700" />
            Pre-orders only
          </label>
          <button type="submit" className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Apply
          </button>
          {(q || range.key !== 'all' || preorderOnly) && (
            <Link href={qs({ q: undefined, range: undefined, preorder: undefined, page: undefined })} className="text-sm text-slate-500 hover:underline">
              Reset
            </Link>
          )}
        </form>

        <OrdersTable rows={rows} />

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <span>
              Page {page} of {pages} · {total} orders
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={qs({ page: String(page - 1) })} className="rounded-md border border-slate-200 px-3 py-1 hover:bg-slate-50">
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link href={qs({ page: String(page + 1) })} className="rounded-md border border-slate-200 px-3 py-1 hover:bg-slate-50">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
