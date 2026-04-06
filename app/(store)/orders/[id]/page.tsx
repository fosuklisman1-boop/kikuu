export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { formatGHS } from '@/lib/utils'
import type { OrderItem, GhanaAddress } from '@/lib/supabase/types'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Order Details' }

interface Props {
  params: Promise<{ id: string }>
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Payment Pending',
  paid: 'Payment Confirmed',
  processing: 'Being Prepared',
  shipped: 'On the Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
}

export default async function OrderPage({ params }: Props) {
  const { id } = await params

  // Try authenticated user first
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let order
  if (user) {
    const { data } = await supabase
      .from('orders')
      .select('*, order_events(*)')
      .eq('id', id)
      .single()
    order = data
  } else {
    // Allow guest to view their order via admin client (no RLS)
    const admin = createAdminClient()
    const { data } = await admin
      .from('orders')
      .select('*, order_events(*)')
      .eq('id', id)
      .single()
    order = data
  }

  if (!order) notFound()

  const items = order.items as OrderItem[]
  const address = order.shipping_address as GhanaAddress

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order {order.order_number}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Placed on {new Date(order.created_at).toLocaleDateString('en-GH')}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[order.status]}`}>
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border divide-y mb-6">
        {items.map((item, i) => (
          <div key={i} className="flex gap-4 p-4">
            {item.product_image && (
              <img
                src={item.product_image}
                alt={item.product_name}
                className="w-16 h-16 object-cover rounded-lg"
              />
            )}
            <div className="flex-1">
              <p className="font-medium text-gray-900">{item.product_name}</p>
              <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
            </div>
            <p className="font-semibold text-gray-900">
              {formatGHS(item.price * item.quantity)}
            </p>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border p-4 mb-6 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span><span>{formatGHS(order.subtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Shipping</span><span>{formatGHS(order.shipping_fee)}</span>
        </div>
        {order.discount_amount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount</span><span>-{formatGHS(order.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-gray-900 border-t pt-2">
          <span>Total</span><span>{formatGHS(order.total)}</span>
        </div>
      </div>

      {/* Delivery address */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <h2 className="font-semibold text-gray-900 mb-2">Delivery Address</h2>
        <p className="text-sm text-gray-600">{address.recipient_name}</p>
        <p className="text-sm text-gray-600">{address.phone}</p>
        <p className="text-sm text-gray-600">
          {address.city}, {address.district}, {address.region}
        </p>
        {address.landmark && (
          <p className="text-sm text-gray-600">Near: {address.landmark}</p>
        )}
      </div>

      {/* Order timeline */}
      {order.order_events && order.order_events.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-900 mb-4">Order Timeline</h2>
          <ol className="relative border-l border-gray-200 space-y-4 ml-3">
            {(order.order_events as any[]).map((evt) => (
              <li key={evt.id} className="ml-4">
                <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-green-500" />
                <p className="text-sm font-medium text-gray-900">{evt.event}</p>
                {evt.description && (
                  <p className="text-xs text-gray-500">{evt.description}</p>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(evt.created_at).toLocaleString('en-GH')}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}