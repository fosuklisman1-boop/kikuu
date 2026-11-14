export const dynamic = 'force-dynamic'
import { getPendingWithdrawalRequests, getWithdrawalHistory } from '@/lib/actions/withdrawals'
import { getWithdrawalSettings } from '@/lib/actions/wallet'
import { formatGHS } from '@/lib/utils'
import WithdrawalActions from '@/components/admin/WithdrawalActions'
import ManualAdjustmentForm from '@/components/admin/ManualAdjustmentForm'
import MinAmountForm from '@/components/admin/MinAmountForm'
import { SearchScope, SearchItem } from '@/components/ui/InstantSearch'
import { PageHeader, Panel, PanelTitle, Badge, EmptyState, TH, THR, TD, ROW, THEAD, TBODY } from '@/components/admin/ui'

export default async function AdminWithdrawalsPage() {
  const [pending, history, settings] = await Promise.all([
    getPendingWithdrawalRequests(),
    getWithdrawalHistory(),
    getWithdrawalSettings(),
  ])

  const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader title="Withdrawals" description="Seller payout requests." action={<MinAmountForm initialAmount={settings.min_amount} />} />

      <Panel className="overflow-hidden">
        <PanelTitle action={pending.length > 0 ? <Badge tone="amber">{pending.length} pending</Badge> : undefined}>Pending requests</PanelTitle>
        {pending.length === 0 ? (
          <EmptyState title="No pending requests" hint="New payout requests will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <SearchScope placeholder="Search by shop, MoMo name or number" barClassName="mb-0 px-4 pt-3 pb-2">
              <table className="w-full text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className={TH}>Shop</th>
                    <th className={THR}>Amount</th>
                    <th className={TH}>MoMo</th>
                    <th className={TH}>Requested</th>
                    <th className={THR}>Actions</th>
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {pending.map((r) => (
                    <SearchItem
                      as="tr"
                      key={r.id}
                      text={`${r.shop.name} ${(r as any).momo_name ?? ''} ${(r as any).momo_number ?? ''} ${(r as any).status ?? ''} ${(r as any).admin_note ?? ''}`}
                      className={ROW}
                    >
                      <td className={`${TD} font-medium text-slate-900`}>{r.shop.name}</td>
                      <td className={`${TD} text-right font-semibold tabular-nums`}>{formatGHS(r.amount)}</td>
                      <td className={`${TD} text-slate-600`}>{r.momo_name} · {r.momo_number}</td>
                      <td className={`${TD} text-slate-500`}>{day(r.requested_at)}</td>
                      <td className={`${TD} text-right`}><WithdrawalActions requestId={r.id} /></td>
                    </SearchItem>
                  ))}
                </tbody>
              </table>
            </SearchScope>
          </div>
        )}
      </Panel>

      <ManualAdjustmentForm />

      <Panel className="overflow-hidden">
        <PanelTitle>History</PanelTitle>
        {history.length === 0 ? (
          <EmptyState title="Nothing processed yet" />
        ) : (
          <div className="overflow-x-auto">
            <SearchScope placeholder="Search by shop, MoMo name or number" barClassName="mb-0 px-4 pt-3 pb-2">
              <table className="w-full text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className={TH}>Shop</th>
                    <th className={THR}>Amount</th>
                    <th className={TH}>Result</th>
                    <th className={TH}>Processed</th>
                    <th className={TH}>Note</th>
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {history.map((r) => (
                    <SearchItem
                      as="tr"
                      key={r.id}
                      text={`${r.shop.name} ${(r as any).momo_name ?? ''} ${(r as any).momo_number ?? ''} ${(r as any).status ?? ''} ${(r as any).admin_note ?? ''}`}
                      className={ROW}
                    >
                      <td className={`${TD} font-medium text-slate-900`}>{r.shop.name}</td>
                      <td className={`${TD} text-right tabular-nums`}>{formatGHS(r.amount)}</td>
                      <td className={TD}>
                        <Badge tone={r.status === 'paid' ? 'green' : 'red'}>{r.status === 'paid' ? 'Paid' : 'Rejected'}</Badge>
                      </td>
                      <td className={`${TD} text-slate-500`}>{r.processed_at ? day(r.processed_at) : '—'}</td>
                      <td className={`${TD} text-slate-500`}>{r.admin_note ?? '—'}</td>
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
