export const dynamic = 'force-dynamic'
import { getPendingWithdrawalRequests, getWithdrawalHistory } from '@/lib/actions/withdrawals'
import { getWithdrawalSettings } from '@/lib/actions/wallet'
import { formatGHS } from '@/lib/utils'
import WithdrawalActions from '@/components/admin/WithdrawalActions'
import ManualAdjustmentForm from '@/components/admin/ManualAdjustmentForm'
import MinAmountForm from '@/components/admin/MinAmountForm'

export default async function AdminWithdrawalsPage() {
  const [pending, history, settings] = await Promise.all([
    getPendingWithdrawalRequests(),
    getWithdrawalHistory(),
    getWithdrawalSettings(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Withdrawals</h1>
        <MinAmountForm initialAmount={settings.min_amount} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400">No pending requests.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
                <th className="py-2 pr-4">Shop</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">MoMo</th>
                <th className="py-2 pr-4">Requested</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 font-medium text-gray-800">{r.shop.name}</td>
                  <td className="py-3 pr-4">{formatGHS(r.amount)}</td>
                  <td className="py-3 pr-4 text-gray-500">{r.momo_name} — {r.momo_number}</td>
                  <td className="py-3 pr-4 text-gray-500">
                    {new Date(r.requested_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-3"><WithdrawalActions requestId={r.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ManualAdjustmentForm />

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">No processed requests yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
                <th className="py-2 pr-4">Shop</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Processed</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 font-medium text-gray-800">{r.shop.name}</td>
                  <td className="py-3 pr-4">{formatGHS(r.amount)}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-500">
                    {r.processed_at ? new Date(r.processed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="py-3 text-gray-500">{r.admin_note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
