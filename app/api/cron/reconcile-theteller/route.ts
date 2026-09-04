import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processVerification } from '@/lib/payment-verification'

// Vercel Cron sends this request automatically with the Authorization header
// set to `Bearer ${CRON_SECRET}` once that env var exists on the project —
// this is Vercel's own documented convention, not custom auth logic.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: staleOrders, error: staleOrdersError } = await admin
    .from('orders')
    .select('id, theteller_transaction_id, created_at')
    .eq('payment_type', 'theteller')
    .eq('status', 'pending')
    .lt('created_at', tenMinutesAgo)
    .not('theteller_transaction_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(50)

  if (staleOrdersError) {
    console.error('Reconciliation query failed:', staleOrdersError)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const orderIds = (staleOrders ?? []).map((o) => o.id)

  // Orders already flagged by the amount-sanity guard are parked for manual
  // review — don't re-process them on every tick. Scoped to this batch's
  // order_ids (uses the existing order_id index) rather than scanning the
  // whole order_events table.
  const { data: flaggedEvents, error: flaggedEventsError } = orderIds.length
    ? await admin
        .from('order_events')
        .select('order_id')
        .eq('event', 'Payment Verification Error')
        .in('order_id', orderIds)
    : { data: [], error: null }

  if (flaggedEventsError) {
    console.error('Flagged-events query failed:', flaggedEventsError)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const flaggedOrderIds = new Set((flaggedEvents ?? []).map((e) => e.order_id))

  const results = []
  let hadFailure = false

  for (const order of staleOrders ?? []) {
    if (flaggedOrderIds.has(order.id)) {
      results.push({ orderId: order.id, ok: false, skipped: 'flagged_for_manual_review' })
      continue
    }
    // Give an ambiguous status plenty of room to resolve itself (MoMo
    // approvals can be slow) before finally giving up on it — past 24
    // hours pending, treat it the same way the browser-redirect path
    // would: a non-success status is a real failure, not a maybe.
    const stillWithinGracePeriod = order.created_at > twentyFourHoursAgo
    try {
      const result = await processVerification(admin, order.id, order.theteller_transaction_id!, {
        autoCancel: !stillWithinGracePeriod,
      })
      results.push({ orderId: order.id, ok: result.ok })
    } catch (err) {
      console.error(`Reconciliation failed for order ${order.id}:`, err)
      results.push({ orderId: order.id, ok: false, error: 'exception' })
      hadFailure = true
    }
  }

  return NextResponse.json(
    { checked: results.length, results },
    { status: hadFailure ? 500 : 200 }
  )
}
