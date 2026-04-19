import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTransaction } from '@/lib/paystack'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orderId = searchParams.get('order_id')
  const reference = searchParams.get('reference') ?? searchParams.get('trxref')

  if (!orderId || !reference) {
    return NextResponse.redirect(new URL('/cart', req.url))
  }

  const admin = createAdminClient()

  // Fetch order
  const { data: order } = await admin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (!order || order.paystack_reference !== reference) {
    return NextResponse.redirect(new URL('/cart?error=invalid_order', req.url))
  }

  // Already processed
  if (order.status !== 'pending') {
    return NextResponse.redirect(new URL(`/orders/${orderId}`, req.url))
  }

  try {
    const result = await verifyTransaction(reference)

    if (result.status === 'success') {
      // Verify amount matches (in pesewas)
      const expectedPesewas = Math.round(order.total * 100)
      if (result.amount < expectedPesewas) {
        await admin.from('orders').update({ status: 'cancelled' }).eq('id', orderId).eq('status', 'pending')
        return NextResponse.redirect(new URL(`/orders/${orderId}?error=amount_mismatch`, req.url))
      }

      // Atomic guard: only update if status is still 'pending'.
      // If the webhook already ran, this matches 0 rows and we skip
      // stock decrement — preventing a double-decrement race condition.
      const { data: updated } = await admin
        .from('orders')
        .update({
          status: 'paid',
          payment_method: result.channel,
          payment_reference: result.reference,
        })
        .eq('id', orderId)
        .eq('status', 'pending')
        .select('id')

      if (updated && updated.length > 0) {
        await admin.from('order_events').insert({
          order_id: orderId,
          event: 'Payment Confirmed',
          description: `Payment received via ${result.channel}.`,
        })

        // Decrement stock — skip pre-order items (no physical stock yet)
        const items = order.items as any[]
        for (const item of items) {
          if (!item.is_preorder) {
            await admin.rpc('decrement_stock', {
              p_product_id: item.product_id,
              p_qty: item.quantity,
            })
          }
        }
      }

      return NextResponse.redirect(new URL(`/orders/${orderId}?success=1`, req.url))
    } else {
      await admin.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
      await admin.from('order_events').insert({
        order_id: orderId,
        event: 'Payment Failed',
        description: `Payment ${result.status}.`,
      })
      return NextResponse.redirect(new URL(`/orders/${orderId}?error=payment_failed`, req.url))
    }
  } catch (err) {
    console.error('Verify error:', err)
    return NextResponse.redirect(new URL(`/orders/${orderId}?error=verify_failed`, req.url))
  }
}
