export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { formatGHS } from '@/lib/utils'
import CouponRowActions from '@/components/admin/CouponRowActions'
import { SearchScope, SearchItem } from '@/components/ui/InstantSearch'

export const metadata: Metadata = { title: 'Coupons' }

function couponStatus(c: { active: boolean; expires_at: string | null; used_count: number; max_uses: number | null }) {
  if (!c.active) return { label: 'Inactive', cls: 'bg-slate-100 text-slate-500' }
  if (c.expires_at && new Date(c.expires_at) <= new Date()) return { label: 'Expired', cls: 'bg-red-100 text-red-600' }
  if (c.max_uses && c.used_count >= c.max_uses) return { label: 'Exhausted', cls: 'bg-orange-100 text-orange-600' }
  return { label: 'Active', cls: 'bg-emerald-100 text-emerald-700' }
}

export default async function CouponsPage() {
  const admin = createAdminClient()
  const { data: coupons } = await admin
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Coupons</h1>
          <p className="text-sm text-slate-500 mt-0.5">{coupons?.length ?? 0} coupon{coupons?.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/admin/coupons/new"
          className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={15} /> New Coupon
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {coupons && coupons.length > 0 ? (
          <div className="overflow-x-auto">
            <SearchScope placeholder="Search coupons by code…" barClassName="mb-0 px-4 pt-3 pb-2">
<table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Discount</th>
                  <th className="px-4 py-3 text-left">Min Order</th>
                  <th className="px-4 py-3 text-left">Usage</th>
                  <th className="px-4 py-3 text-left">Expires</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coupons.map((c) => {
                  const status = couponStatus(c)
                  return (
                    <SearchItem as="tr" key={c.id} text={`${c.code} ${c.type} ${status}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg text-xs">
                          {c.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {c.type === 'percentage' ? `${c.value}%` : formatGHS(c.value)} off
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {c.min_order_amount ? formatGHS(c.min_order_amount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ' uses'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {c.expires_at
                          ? new Date(c.expires_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <CouponRowActions id={c.id} active={c.active} />
                      </td>
                    </SearchItem>
                  )
                })}
              </tbody>
            </table>
</SearchScope>
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400">
            <div className="text-4xl mb-3">🎟️</div>
            <p className="font-medium">No coupons yet</p>
            <Link href="/admin/coupons/new" className="text-sm text-emerald-600 hover:underline mt-1 inline-block">
              Create your first coupon
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
