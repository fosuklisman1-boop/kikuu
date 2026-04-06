export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function AdminDashboard() {
  const admin = createAdminClient()

  const [
    { count: totalOrders },
    { count: pendingOrders },
    { data: revenueData },
    { count: totalProducts },
  ] = await Promise.all([
    admin.from('orders').select('*', { count: 'exact', head: true }),
    admin.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('orders').select('total').in('status', ['paid', 'processing', 'shipped', 'delivered']),
    admin.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  const totalRevenue = revenueData?.reduce((sum, o) => sum + o.total, 0) ?? 0

  const stats = [
    { label: 'Total Revenue', value: formatGHS(totalRevenue), color: 'bg-green-500' },
    { label: 'Total Orders', value: String(totalOrders ?? 0), color: 'bg-blue-500' },
    { label: 'Pending Orders', value: String(pendingOrders ?? 0), color: 'bg-yellow-500' },
    { label: 'Active Products', value: String(totalProducts ?? 0), color: 'bg-purple-500' },
  ]

  const { data: recentOrders } = await admin
    .from('orders')
    .select('id, order_number, buyer_name, total, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm">
            <div className={`w-3 h-3 rounded-full ${s.color} mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Total</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentOrders?.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    <a href={`/admin/orders/${order.id}`} className="text-blue-600 hover:underline">
                      {order.order_number}
                    </a>
                  </td>
                  <td className="px-4 py-3">{order.buyer_name}</td>
                  <td className="px-4 py-3 font-medium">{formatGHS(order.total)}</td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-xs px-2 py-1 rounded-full bg-gray-100">
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(order.created_at).toLocaleDateString('en-GH')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}