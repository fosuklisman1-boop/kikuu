import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTransaction } from '@/lib/paystack'
import { checkTransactionStatus } from '@/lib/theteller'
import { creditShopEarnings } from '@/lib/wallet-ledger'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

export async function processVerification(
  admin: SupabaseAdmin,
  orderId: string,
  reference: string,
  options?: { autoCancel?: boolean }
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const autoCancel = options?.autoCancel ?? true
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
    const isTerminallyFailed = order.status === 'cancelled' || order.status === 'refunded'
    return isTerminallyFailed
      ? { ok: false, error: 'Order is not payable.', code: 'not_pending' }
      : { ok: true }
  }

  const result = order.payment_type === 'theteller'
    ? await checkTransactionStatus(reference).then((r) => ({
        success: r.code === '000',
        amount: Math.round(r.amount * 100), // GHS -> pesewas, ASSUMING r.amount is GHS decimal (unverified — see amount-sanity guard below, and the note on TransactionStatusResult.amount)
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

    if (!Number.isFinite(result.amount) || result.amount > expectedPesewas * 10) {
      await admin.from('order_events').insert({
        order_id: orderId,
        event: 'Payment Verification Error',
        description: `Amount sanity check failed: expected GHS ${(expectedPesewas / 100).toFixed(2)}, gateway reported ${result.amount} (raw units, unit unconfirmed). Refusing to mark paid — possible currency-unit mismatch. Order left pending for manual review.`,
      })
      return { ok: false, error: 'Payment verification error. Please contact support.', code: 'amount_sanity_check_failed' }
    }

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
    if (!autoCancel) {
      return { ok: false, error: `Payment ${result.statusLabel}.`, code: 'payment_not_confirmed' }
    }
    await admin.from('orders').update({ status: 'cancelled' }).eq('id', orderId).eq('status', 'pending')
    await admin.from('order_events').insert({
      order_id: orderId,
      event: 'Payment Failed',
      description: `Payment ${result.statusLabel}.`,
    })
    return { ok: false, error: `Payment ${result.statusLabel}. Order cancelled.`, code: 'payment_failed' }
  }
}
