export const dynamic = 'force-dynamic'
import { getWalletBalance, getWalletTransactions } from '@/lib/actions/wallet'
import { formatGHS } from '@/lib/utils'

export default async function SellerWalletPage() {
  const [balance, transactions] = await Promise.all([
    getWalletBalance(),
    getWalletTransactions(),
  ])

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Wallet</h1>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8 max-w-sm">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Available balance</p>
        <p className="text-3xl font-bold text-gray-900">{formatGHS(balance)}</p>
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Transaction history</h2>

      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No transactions yet.</p>
      ) : (
        <table className="w-full text-sm">
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
    </div>
  )
}
