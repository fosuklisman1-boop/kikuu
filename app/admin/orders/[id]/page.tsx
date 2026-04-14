export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { formatGHS } from '@/lib/utils'
import type { OrderItem, GhanaAddress } from '@/lib/supabase/types'
import UpdateOrderStatusForm from '@/components/admin/UpdateOrderStatusForm'
import ConfirmCodButton from '@/components/admin/ConfirmCodButton'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Order Details' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select('*, order_events(*)')
    .eq('id', id)
    .single()

  if (!order) notFound()

  const items = order.items as OrderItem[]
  const address = order.shipping_address as GhanaAddress
  const isCod = (order as any).payment_type === 'cod'
  const isPreorder = (order as any).is_preorder
  const preorderShipDate = (order as any).pre_order_ship_date as string | null
  const paymentStatus = (order as any).payment_status as string

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{order.order_number}</h1>
            {isPreorder && (
              <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                PRE-ORDER
              </span>
            )}
            {isCod && (
              <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                CASH ON DELIVERY
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleString('en-GH')}</p>
        </div>
        <UpdateOrderStatusForm orderId={order.id} currentStatus={order.status} />
      </div>

      {/* Pre-order info banner */}
      {isPreorder && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm font-semibold text-orange-800">Pre-order</p>
          {preorderShipDate && (
            <p className="text-xs text-orange-600 mt-0.5">
              Expected ship date: {new Date(preorderShipDate).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
          <p className="text-xs text-orange-500 mt-0.5">Stock will be decremented when order is fulfilled.</p>
        </div>
      )}

      {/* COD payment status */}
      {isCod && (
        <div className={`rounded-xl px-4 py-3 mb-4 border ${
          paymentStatus === 'paid'
            ? 'bg-green-50 border-green-200'
            : 'bg-purple-50 border-purple-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-semibold ${paymentStatus === 'paid' ? 'text-green-800' : 'text-purple-800'}`}>
                {paymentStatus === 'paid' ? 'Cash Collected' : 'Awaiting Cash on Delivery'}
              </p>
              <p className={`text-xs mt-0.5 ${paymentStatus === 'paid' ? 'text-green-600' : 'text-purple-600'}`}>
                {paymentStatus === 'paid'
                  ? 'Payment has been confirmed.'
                  : `Collect ${formatGHS(order.total)} on delivery.`}
              </p>
            </div>
            {paymentStatus !== 'paid' && (
              <ConfirmCodButton orderId={order.id} />
            )}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Customer */}
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-900 mb-2">Customer</h2>
          <p className="text-sm text-gray-700">{order.buyer_name}</p>
          <p className="text-sm text-gray-500">{order.buyer_email}</p>
          <p className="text-sm text-gray-500">{order.buyer_phone}</p>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-900 mb-2">Delivery Address</h2>
          <p className="text-sm text-gray-700">{address.recipient_name}</p>
          <p className="text-sm text-gray-500">{address.city}, {address.district}</p>
          <p className="text-sm text-gray-500">{address.region}</p>
          {address.landmark && <p className="text-sm text-gray-500">Near: {address.landmark}</p>}
          {address.digital_address && <p className="text-sm text-gray-400">{address.digital_address}</p>}
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border mb-4">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">Items</h2>
        </div>
        <div className="divide-y">
          {items.map((item, i) => (
            <div key={i} className="flex gap-4 p-4">
              {item.product_image && (
                <img src={item.product_image} alt={item.product_name} className="w-14 h-14 object-cover rounded" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{item.product_name}</p>
                  {item.is_preorder && (
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">PRE</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">Qty: {item.quantity} × {formatGHS(item.price)}</p>
                {item.is_preorder && item.preorder_ship_date && (
                  <p className="text-xs text-orange-500">Ships by {new Date(item.preorder_ship_date).toLocaleDateString('en-GH')}</p>
                )}
              </div>
              <p className="font-semibold">{formatGHS(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>
        <div className="p-4 border-t space-y-1 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span><span>{formatGHS(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Shipping</span><span>{formatGHS(order.shipping_fee)}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span><span>-{formatGHS(order.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 pt-2 border-t">
            <span>Total</span><span>{formatGHS(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Payment */}
      <div className="bg-white rounded-xl border p-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-2">Payment</h2>
        <p className="text-sm text-gray-500">
          Type: {isCod ? 'Cash on Delivery' : 'Paystack'}
        </p>
        {!isCod && (
          <>
            <p className="text-sm text-gray-500">Channel: {order.payment_method ?? '—'}</p>
            <p className="text-sm text-gray-500 font-mono">Ref: {order.paystack_reference ?? '—'}</p>
          </>
        )}
      </div>

      {/* Events */}
      {order.order_events && (order.order_events as any[]).length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-900 mb-4">Timeline</h2>
          <ol className="relative border-l border-gray-200 space-y-4 ml-3">
            {(order.order_events as any[]).map((evt) => (
              <li key={evt.id} className="ml-4">
                <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-[#b45309]" />
                <p className="text-sm font-medium text-gray-900">{evt.event}</p>
                {evt.description && <p className="text-xs text-gray-500">{evt.description}</p>}
                <p className="text-xs text-gray-400">{new Date(evt.created_at).toLocaleString('en-GH')}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
