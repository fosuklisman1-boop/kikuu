export const dynamic = 'force-dynamic'
import { getAllShops } from '@/lib/actions/shops-admin'
import ShopActiveToggle from '@/components/admin/ShopActiveToggle'
import Link from 'next/link'
import { formatGHS } from '@/lib/utils'

export default async function AdminShopsPage() {
  const shops = await getAllShops()

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Shops ({shops.length})</h1>

      {shops.length === 0 ? (
        <p className="text-sm text-gray-400">No shops yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
              <th className="py-2 pr-4">Shop</th>
              <th className="py-2 pr-4">Owner</th>
              <th className="py-2 pr-4">Products</th>
              <th className="py-2 pr-4">Created</th>
              <th className="py-2 pr-4">Balance</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-3 pr-4">
                  <Link href={`/shop/${s.slug}`} target="_blank" className="font-medium text-gray-800 hover:text-green-600">
                    {s.name}
                  </Link>
                  <p className="text-xs text-gray-400">/shop/{s.slug}</p>
                </td>
                <td className="py-3 pr-4 text-gray-500">{s.owner_email ?? '—'}</td>
                <td className="py-3 pr-4 text-gray-500">{s.product_count}</td>
                <td className="py-3 pr-4 text-gray-500">
                  {new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="py-3 pr-4 font-medium">{formatGHS(s.wallet_balance)}</td>
                <td className="py-3"><ShopActiveToggle shopId={s.id} active={s.active} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
