export const dynamic = 'force-dynamic'
import { getAllShops } from '@/lib/actions/shops-admin'
import ShopActiveToggle from '@/components/admin/ShopActiveToggle'
import CommissionSettingsForm from '@/components/admin/CommissionSettingsForm'
import { getDefaultCommissionPercent } from '@/lib/actions/commission'
import Link from 'next/link'
import { formatGHS } from '@/lib/utils'
import { SearchScope, SearchItem } from '@/components/ui/InstantSearch'
import { PageHeader, Panel, EmptyState, TH, THR, TD, ROW, THEAD, TBODY } from '@/components/admin/ui'

export default async function AdminShopsPage() {
  const [shops, defaultPercent] = await Promise.all([getAllShops(), getDefaultCommissionPercent()])

  return (
    <div className="max-w-6xl">
      <PageHeader title="Shops" description={`${shops.length} seller shop${shops.length === 1 ? '' : 's'}`} />

      <div className="mb-5">
        <CommissionSettingsForm initialPercent={defaultPercent} />
      </div>

      <Panel className="overflow-hidden">
        {shops.length === 0 ? (
          <EmptyState title="No shops yet" hint="Shops appear here once sellers finish onboarding." />
        ) : (
          <div className="overflow-x-auto">
            <SearchScope placeholder="Search shops by name, slug or owner" barClassName="mb-0 px-4 pt-3 pb-2">
              <table className="w-full text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className={TH}>Shop</th>
                    <th className={TH}>Owner</th>
                    <th className={THR}>Products</th>
                    <th className={TH}>Created</th>
                    <th className={THR}>Balance</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {shops.map((s) => (
                    <SearchItem as="tr" key={s.id} text={`${s.name} ${s.slug} ${s.owner_email ?? ''}`} className={ROW}>
                      <td className={TD}>
                        <Link href={`/shop/${s.slug}`} target="_blank" className="font-medium text-slate-900 hover:text-emerald-800">
                          {s.name}
                        </Link>
                        <p className="text-xs text-slate-400">/shop/{s.slug}</p>
                      </td>
                      <td className={`${TD} text-slate-500`}>{s.owner_email ?? '—'}</td>
                      <td className={`${TD} text-right tabular-nums text-slate-600`}>{s.product_count}</td>
                      <td className={`${TD} text-slate-500`}>
                        {new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className={`${TD} text-right font-medium tabular-nums`}>{formatGHS(s.wallet_balance)}</td>
                      <td className={TD}><ShopActiveToggle shopId={s.id} active={s.active} /></td>
                    </SearchItem>
                  ))}
                </tbody>
              </table>
            </SearchScope>
          </div>
        )}
      </Panel>
    </div>
  )
}
