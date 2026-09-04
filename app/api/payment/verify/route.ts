import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTransaction } from '@/lib/paystack'
import { checkTransactionStatus } from '@/lib/theteller'
import { creditShopEarnings } from '@/lib/wallet-ledger'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

export async function processVerification(
  admin: SupabaseAdmin,
  orderId: string,
  reference: string
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const { data: order } = await admin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  const expectedReference = order?.payment_type === 'theteller'
    ? order.theteller_transaction_id
    : order?.paystack_reference

  if (!order || expectedReference !== reference) {
    return { ok: false, error: 'Invalid order or reference', code: 'invalid_order' }
  }

  // Already processed (webhook, or a racing reconciliation-cron run, may have beaten us)
  if (order.status !== 'pending') {
    return { ok: true }
  }

  const result = order.payment_type === 'theteller'
    ? await checkTransactionStatus(reference).then((r) => ({
        success: r.code === '000',
        amount: Math.round(r.amount * 100), // GHS -> pesewas, matching Paystack's existing units
        channel: 'theteller',
        statusLabel: r.status, // e.g. 'approved', or a failure reason string
      }))
    : await verifyTransaction(reference).then((r) => ({
        success: r.status === 'success',
        amount: r.amount, // already pesewas
        channel: r.channel,
        statusLabel: r.status,
      }))

  if (result.success) {
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
        payment_reference: reference,
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

      await creditShopEarnings(orderId)
    }

    return { ok: true }
  } else {
    await admin.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    await admin.from('order_events').insert({
      order_id: orderId,
      event: 'Payment Failed',
      description: `Payment ${result.statusLabel}.`,
    })
    return { ok: false, error: `Payment ${result.statusLabel}. Order cancelled.`, code: 'payment_failed' }
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
