export const dynamic = 'force-dynamic'
import { getWalletBalance, getWalletTransactions, getWithdrawableBalance, getWithdrawalSettings, getMyWithdrawalRequests } from '@/lib/actions/wallet'
import { getMyShop } from '@/lib/actions/shops'
import { formatGHS } from '@/lib/utils'
import WithdrawalPanel from '@/components/seller/WithdrawalPanel'

export default async function SellerWalletPage() {
  const [balance, transactions, withdrawableBalance, settings, myRequests, shop] = await Promise.all([
    getWalletBalance(),
    getWalletTransactions(),
    getWithdrawableBalance(),
    getWithdrawalSettings(),
    getMyWithdrawalRequests(),
    getMyShop(),
  ])

  const pendingRequest = myRequests.find((r) => r.status === 'pending') ?? null

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Wallet</h1>

      <div className="flex flex-wrap gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 max-w-xs">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total balance</p>
          <p className="text-3xl font-bold text-gray-900">{formatGHS(balance)}</p>
        </div>

        <WithdrawalPanel
          momoNumber={shop?.momo_number ?? null}
          momoName={shop?.momo_name ?? null}
          withdrawableBalance={withdrawableBalance}
          minAmount={settings.min_amount}
          pendingRequest={pendingRequest}
        />
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Transaction history</h2>

      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No transactions yet.</p>
      ) : (
        <table className="w-full text-sm mb-10">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Description</th>
              <th className="py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-gray-100">
                <td className="py-3 pr-4 text-gray-500">
                  {new Date(tx.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="py-3 pr-4 text-gray-800">{tx.description}</td>
                <td className={`py-3 font-semibold ${tx.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.type === 'credit' ? '+' : '−'}{formatGHS(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {myRequests.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Withdrawal history</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 text-gray-500">
                    {new Date(r.requested_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-3 pr-4 text-gray-800">{formatGHS(r.amount)}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.status === 'paid' ? 'bg-green-50 text-green-700' : r.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 text-gray-500">{r.admin_note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
