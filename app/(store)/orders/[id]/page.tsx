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

  const PROGRESS_STEPS = ['pending', 'paid', 'processing', 'shipped', 'delivered']
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded'
  const currentStep = isCancelled ? -1 : PROGRESS_STEPS.indexOf(order.status)

  const STEP_LABELS: Record<string, string> = {
    pending: 'Order Placed',
    paid: 'Payment Confirmed',
    processing: 'Being Packed',
    shipped: 'On the Way',
    delivered: 'Delivered',
  }

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

      {/* Progress tracker */}
      {isCancelled ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-6 text-center">
          <p className="text-red-700 font-semibold text-sm">
            {order.status === 'refunded' ? 'This order has been refunded.' : 'This order was cancelled.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl px-5 py-5 mb-6">
          <div className="flex items-center">
            {PROGRESS_STEPS.map((step, i) => {
              const done = i < currentStep
              const active = i === currentStep
              return (
                <div key={step} className="flex-1 flex flex-col items-center relative">
                  {/* Connector line */}
                  {i > 0 && (
                    <div className={`absolute left-0 right-1/2 top-3.5 h-0.5 -translate-y-1/2 ${done || active ? 'bg-[#b45309]' : 'bg-gray-200'}`} style={{ right: '50%', left: '-50%' }} />
                  )}
                  {i < PROGRESS_STEPS.length - 1 && (
                    <div className={`absolute top-3.5 h-0.5 -translate-y-1/2 ${done ? 'bg-[#b45309]' : 'bg-gray-200'}`} style={{ left: '50%', right: '-50%' }} />
                  )}
                  {/* Dot */}
                  <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    done ? 'bg-[#b45309] border-[#b45309] text-white'
                    : active ? 'bg-white border-[#b45309] text-[#b45309]'
                    : 'bg-white border-gray-200 text-gray-300'
                  }`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <p className={`mt-2 text-[10px] font-semibold text-center leading-tight ${
                    active ? 'text-[#b45309]' : done ? 'text-gray-500' : 'text-gray-300'
                  }`}>
                    {STEP_LABELS[step]}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
                <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-[#b45309]" />
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