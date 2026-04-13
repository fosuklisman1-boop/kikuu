export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { formatGHS } from '@/lib/utils'
import Link from 'next/link'
import { Package, ArrowRight, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import type { OrderItem } from '@/lib/supabase/types'

export const metadata: Metadata = { title: 'My Orders' }

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
  paid: 'bg-blue-100 text-blue-700 border-blue-200',
  processing: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  shipped: 'bg-purple-100 text-purple-700 border-purple-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  refunded: 'bg-gray-100 text-gray-600 border-gray-200',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Payment Pending',
  confirmed: 'Order Confirmed',
  paid: 'Payment Confirmed',
  processing: 'Being Prepared',
  shipped: 'On the Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export default async function MyOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, total, status, created_at, items, shipping_fee, discount_amount, subtotal')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">My Orders</h1>
        <span className="text-sm text-gray-400">{orders?.length ?? 0} order{orders?.length !== 1 ? 's' : ''}</span>
      </div>

      {orders && orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((order) => {
            const items = order.items as OrderItem[]
            const firstItem = items?.[0]
            return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all block group"
              >
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    {firstItem?.product_image ? (
                      <img src={firstItem.product_image} alt={firstItem.product_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={20} className="text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-bold text-gray-900 text-sm">{order.order_number}</p>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
                    </div>
                    <p className="text-xs text-gray-400 mb-2">
                      {new Date(order.created_at).toLocaleDateString('en-GH', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                    {items?.length > 0 && (
                      <p className="text-xs text-gray-500 truncate">
                        {items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                  <div className="text-right">
                    <p className="font-extrabold text-gray-900">{formatGHS(order.total)}</p>
                    <p className="text-xs text-gray-400">{items?.length ?? 0} item{items?.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
          <div className="text-5xl mb-4">📦</div>
          <p className="text-gray-600 font-semibold mb-1">No orders yet</p>
          <p className="text-gray-400 text-sm mb-5">When you place orders, they&apos;ll appear here.</p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            Start Shopping <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </div>
  )
}
