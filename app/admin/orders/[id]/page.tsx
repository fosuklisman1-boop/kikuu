export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { formatGHS } from '@/lib/utils'
import type { OrderItem, GhanaAddress } from '@/lib/supabase/types'
import type { DeliveryStatus } from '@/lib/order-status'
import DeliveryStepper from '@/components/admin/DeliveryStepper'
import RefundButton from '@/components/admin/RefundButton'
import { PaymentPill } from '@/components/admin/StatusPills'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Order Details' }

interface Props {
  params: Promise<{ id: string }>
}

const GATEWAY: Record<string, string> = { paystack: 'Paystack', theteller: 'Mobile Money (TheTeller)', cod: 'Cash on delivery' }

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select('*, order_events(*)')
    .eq('id', id)
    .single()

  // Admin only works with paid orders (refunded ones stay visible for the record).
  if (!order || (order.payment_status !== 'paid' && order.payment_status !== 'refunded')) notFound()

  const items = order.items as OrderItem[]
  const address = order.shipping_address as GhanaAddress
  const preorderShipDate = order.pre_order_ship_date as string | null
  const reference = order.payment_reference ?? order.theteller_transaction_id ?? order.paystack_reference
  const refunded = order.payment_status === 'refunded'
  const events = [...((order.order_events as any[]) ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="max-w-5xl">
      <Link href="/admin/orders" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ChevronLeft size={16} /> Orders
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-slate-900">{order.order_number}</h1>
            <PaymentPill status={order.payment_status} />
            {order.is_preorder && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Pre-order</span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">Placed {new Date(order.created_at).toLocaleString('en-GH')}</p>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-slate-900">{formatGHS(order.total)}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5 min-w-0">
          {order.is_preorder && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-medium text-amber-900">Pre-order</p>
              {preorderShipDate && (
                <p className="mt-0.5 text-xs text-amber-800">
                  Expected ship date:{' '}
                  {new Date(preorderShipDate).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          )}

          <section className="rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-900">
              Items ({items.reduce((n, i) => n + i.quantity, 0)})
            </h2>
            <ul className="divide-y divide-slate-100">
              {items.map((item, i) => (
                <li key={i} className="flex gap-4 px-5 py-4">
                  {item.product_image ? (
                    <img src={item.product_image} alt="" className="h-14 w-14 rounded-lg border border-slate-100 object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-slate-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{item.product_name}</p>
                    {(item.selected_color || item.selected_size) && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        {item.selected_color && (
                          <>
                            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-slate-200" style={{ background: item.selected_color.hex }} />
                            <span>{item.selected_color.name}</span>
                          </>
                        )}
                        {item.selected_color && item.selected_size && <span>·</span>}
                        {item.selected_size && <span>{item.selected_size}</span>}
                      </p>
                    )}
                    <p className="mt-0.5 text-sm text-slate-500 tabular-nums">
                      {item.quantity} × {formatGHS(item.price)}
                    </p>
                    {item.is_preorder && item.preorder_ship_date && (
                      <p className="text-xs text-amber-700">
                        Delivers by {new Date(item.preorder_ship_date).toLocaleDateString('en-GH')}
                        {item.preorder_note && ` · ${item.preorder_note}`}
                      </p>
                    )}
                  </div>
                  <p className="font-semibold tabular-nums text-slate-900">{formatGHS(item.price * item.quantity)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-slate-100 px-5 py-4 text-sm tabular-nums">
              <div className="flex justify-between text-slate-500"><dt>Subtotal</dt><dd>{formatGHS(order.subtotal)}</dd></div>
              <div className="flex justify-between text-slate-500"><dt>Delivery</dt><dd>{formatGHS(order.shipping_fee)}</dd></div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>-{formatGHS(order.discount_amount)}</dd></div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900"><dt>Total</dt><dd>{formatGHS(order.total)}</dd></div>
            </dl>
          </section>

          {events.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Activity</h2>
              <ol className="relative ml-1.5 space-y-4 border-l border-slate-200">
                {events.map((evt) => (
                  <li key={evt.id} className="ml-4">
                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-emerald-600 ring-4 ring-white" />
                    <p className="text-sm font-medium text-slate-900">{evt.event}</p>
                    {evt.description && <p className="text-xs text-slate-500">{evt.description}</p>}
                    <p className="text-xs text-slate-400">{new Date(evt.created_at).toLocaleString('en-GH')}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Delivery</h2>
            {refunded ? (
              <p className="text-sm text-slate-500">This order was refunded, so delivery is closed.</p>
            ) : (
              <DeliveryStepper orderId={order.id} current={order.delivery_status as DeliveryStatus | null} />
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Payment</h2>
              <PaymentPill status={order.payment_status} />
            </div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Method</dt><dd className="text-right text-slate-900">{GATEWAY[order.payment_type] ?? order.payment_type}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Channel</dt><dd className="text-right text-slate-900">{order.payment_method ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Reference</dt><dd className="break-all text-right font-mono text-xs text-slate-900">{reference ?? '—'}</dd></div>
            </dl>
            {order.payment_status === 'paid' && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <RefundButton orderId={order.id} total={formatGHS(order.total)} />
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Customer</h2>
            <p className="text-sm font-medium text-slate-900">{order.buyer_name}</p>
            <p className="text-sm text-slate-500">{order.buyer_email}</p>
            <a href={`tel:${order.buyer_phone}`} className="text-sm text-emerald-800 hover:underline">{order.buyer_phone}</a>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Deliver to</h2>
            <address className="text-sm not-italic text-slate-600 space-y-0.5">
              <p className="font-medium text-slate-900">{address.recipient_name}</p>
              <p>{[address.city, address.district].filter(Boolean).join(', ')}</p>
              <p>{address.region}</p>
              {address.landmark && <p>Near {address.landmark}</p>}
              {address.digital_address && <p className="text-slate-400">{address.digital_address}</p>}
            </address>
          </section>
        </aside>
      </div>
    </div>
  )
}
