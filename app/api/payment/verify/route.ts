import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTransaction } from '@/lib/paystack'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

async function processVerification(
  admin: SupabaseAdmin,
  orderId: string,
  reference: string
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const { data: order } = await admin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (!order || order.paystack_reference !== reference) {
    return { ok: false, error: 'Invalid order or reference', code: 'invalid_order' }
  }

  // Already processed (webhook may have beaten us)
  if (order.status !== 'pending') {
    return { ok: true }
  }

  const result = await verifyTransaction(reference)

  if (result.status === 'success') {
    const expectedPesewas = Math.round(order.total * 100)
    if (result.amount < expectedPesewas) {
      await admin.from('orders').update({ status: 'cancelled' }).eq('id', orderId).eq('status', 'pending')
      await admin.from('order_events').insert({
        order_id: orderId,
        event: 'Payment Mismatch',
        description: `Expected GHS ${(expectedPesewas / 100).toFixed(2)} but received GHS ${(result.amount / 100).toFixed(2)}. Order cancelled.`,
      })
      return { ok: false, error: 'Payment amount mismatch. Order cancelled.', code: 'amount_mismatch' }
    }

    // Atomic guard: only update if status is still 'pending'.
    // If the webhook already ran, this matches 0 rows and we skip
    // stock decrement — preventing a double-decrement race condition.
    const { data: updated } = await admin
      .from('orders')
      .update({
        status: 'paid',
        payment_status: 'paid',
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

    return { ok: true }
  } else {
    await admin.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    await admin.from('order_events').insert({
      order_id: orderId,
      event: 'Payment Failed',
      description: `Payment ${result.status}.`,
    })
    return { ok: false, error: `Payment ${result.status}. Order cancelled.`, code: 'payment_failed' }
  }
}

// GET — redirect-based fallback (Paystack hosted page / browser fallback)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orderId = searchParams.get('order_id')
  const reference = searchParams.get('reference') ?? searchParams.get('trxref')

  if (!orderId || !reference) {
    return NextResponse.redirect(new URL('/cart', req.url))
  }

  const admin = createAdminClient()

  try {
    const result = await processVerification(admin, orderId, reference)
    if (result.ok) {
      return NextResponse.redirect(new URL(`/orders/${orderId}?success=1`, req.url))
    } else {
      return NextResponse.redirect(new URL(`/orders/${orderId}?error=${result.code ?? 'error'}`, req.url))
    }
  } catch (err) {
    console.error('Verify GET error:', err)
    return NextResponse.redirect(new URL(`/orders/${orderId}?error=verify_failed`, req.url))
  }
}

// POST — JSON response for Paystack inline modal callback
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const orderId = body?.order_id as string | undefined
  const reference = body?.reference as string | undefined

  if (!orderId || !reference) {
    return NextResponse.json({ error: 'Missing order_id or reference' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    const result = await processVerification(admin, orderId, reference)
    if (result.ok) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (err) {
    console.error('Verify POST error:', err)
    return NextResponse.json({ error: 'Verification failed. Please contact support.' }, { status: 500 })
  }
}
