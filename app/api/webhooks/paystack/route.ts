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

    const { data: order } = await admin
      .from('orders')
      .select('id, status, total, items')
      .eq('paystack_reference', reference)
      .single()

    if (!order || order.status !== 'pending') {
      return NextResponse.json({ received: true }) // idempotent
    }

    await admin.from('orders').update({
      status: 'paid',
      payment_method: event.data.channel,
      payment_reference: reference,
    }).eq('id', order.id)

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
