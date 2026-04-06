export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Orders' }

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  paid: 'bg-blue-100 text-blue-800',
  processing: 'bg-indigo-100 text-indigo-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
}

interface Props {
  searchParams: Promise<{ status?: string; page?: string; filter?: string }>
}

export default async function AdminOrdersPage({ searchParams }: Props) {
  const params = await searchParams
  const status = params.status ?? ''
  const filter = params.filter ?? '' // 'preorder' | 'cod' | ''
  const page = parseInt(params.page ?? '1', 10)
  const PAGE_SIZE = 20
  const from = (page - 1) * PAGE_SIZE

  const admin = createAdminClient()
  let query = admin
    .from('orders')
    .select('id, order_number, buyer_name, buyer_phone, total, status, payment_type, payment_status, is_preorder, pre_order_ship_date, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  if (filter === 'preorder') {
    query = query.eq('is_preorder', true)
  } else if (filter === 'cod') {
    query = query.eq('payment_type', 'cod')
  } else if (status) {
    query = query.eq('status', status)
  }

  const { data: orders, count } = await query

  const statuses = ['', 'pending', 'confirmed', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Orders</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <a
          href="/admin/orders"
          className={`px-3 py-1 rounded-full text-sm border transition ${
            !status && !filter ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600 hover:border-green-600'
          }`}
        >
          All
        </a>
        <a
          href="/admin/orders?filter=preorder"
          className={`px-3 py-1 rounded-full text-sm border transition ${
            filter === 'preorder' ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-300 text-gray-600 hover:border-orange-400'
          }`}
        >
          Pre-orders
        </a>
        <a
          href="/admin/orders?filter=cod"
          className={`px-3 py-1 rounded-full text-sm border transition ${
            filter === 'cod' ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-300 text-gray-600 hover:border-purple-400'
          }`}
        >
          Cash on Delivery
        </a>
        <span className="w-px bg-gray-200 mx-1" />
        {statuses.filter(Boolean).map((s) => (
          <a
            key={s}
            href={`/admin/orders?status=${s}`}
            className={`px-3 py-1 rounded-full text-sm border transition ${
              status === s
                ? 'bg-green-600 text-white border-green-600'
                : 'border-gray-300 text-gray-600 hover:border-green-600'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </a>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Order</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Total</th>
              <th className="px-4 py-3 text-left">Payment</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders?.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-blue-600">
                  <Link href={`/admin/orders/${order.id}`} className="hover:underline">
                    {order.order_number}
                  </Link>
                  {order.is_preorder && (
                    <span className="ml-2 text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
                      PRE
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{order.buyer_name}</td>
                <td className="px-4 py-3 text-gray-500">{order.buyer_phone}</td>
                <td className="px-4 py-3 font-medium">{formatGHS(order.total)}</td>
                <td className="px-4 py-3">
                  {order.payment_type === 'cod' ? (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      order.payment_status === 'paid'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {order.payment_status === 'paid' ? 'COD Paid' : 'COD Pending'}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Paystack</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`capitalize text-xs px-2 py-1 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-gray-100'}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(order.created_at).toLocaleDateString('en-GH')}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${order.id}`} className="text-blue-600 hover:underline text-xs">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders?.length && (
          <p className="text-center text-gray-400 py-12">No orders found.</p>
        )}
      </div>

      {/* Pagination */}
      {(count ?? 0) > PAGE_SIZE && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: Math.ceil((count ?? 0) / PAGE_SIZE) }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/admin/orders?${new URLSearchParams({ ...(status && { status }), ...(filter && { filter }), page: String(p) })}`}
              className={`px-3 py-1 rounded border text-sm ${p === page ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600'}`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
