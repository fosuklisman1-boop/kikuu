import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateWebhookSignature } from '@/lib/paystack'

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-paystack-signature') ?? ''
  const body = await req.text()

  if (!validateWebhookSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body)
  const admin = createAdminClient()

  if (event.event === 'charge.success') {
    const reference = event.data.reference as string
    console.log('[webhook] charge.success reference:', reference)

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, status, total, items')
      .eq('paystack_reference', reference)
      .maybeSingle()

    if (orderErr) {
      console.error('[webhook] order lookup error:', orderErr.message)
      return NextResponse.json({ received: true })
    }

    if (!order) {
      console.warn('[webhook] no order found for reference:', reference)
      return NextResponse.json({ received: true })
    }

    console.log('[webhook] found order:', order.id, 'status:', order.status)

    // Atomic guard: only update if status is still 'pending'.
    // If the verify callback already ran, this matches 0 rows and we skip
    // stock decrement — preventing a double-decrement race condition.
    const { data: updated } = await admin
      .from('orders')
      .update({
        status: 'paid',
        payment_status: 'paid',
        payment_method: event.data.channel,
        payment_reference: reference,
      })
      .eq('id', order.id)
      .eq('status', 'pending')
      .select('id')

    if (!updated || updated.length === 0) {
      return NextResponse.json({ received: true }) // another handler already processed it
    }

    await admin.from('order_events').insert({
      order_id: order.id,
      event: 'Payment Confirmed',
      description: `Payment received via ${event.data.channel} (webhook).`,
    })

    // Decrement stock for non-preorder items so inventory stays accurate
    // even if the user closes their browser before the callback URL loads.
    const items = order.items as { product_id: string; quantity: number; is_preorder: boolean }[]
    for (const item of items) {
      if (!item.is_preorder) {
        await admin.rpc('decrement_stock', {
          p_product_id: item.product_id,
          p_qty: item.quantity,
        })
      }
    }
  }

  return NextResponse.json({ received: true })
}
