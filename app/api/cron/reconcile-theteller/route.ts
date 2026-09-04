import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processVerification } from '@/lib/payment-verification'

// Vercel Cron sends this request automatically with the Authorization header
// set to `Bearer ${CRON_SECRET}` once that env var exists on the project —
// this is Vercel's own documented convention, not custom auth logic.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  const { data: staleOrders } = await admin
    .from('orders')
    .select('id, theteller_transaction_id')
    .eq('payment_type', 'theteller')
    .eq('status', 'pending')
    .lt('created_at', tenMinutesAgo)
    .not('theteller_transaction_id', 'is', null)

  const results = []
  for (const order of staleOrders ?? []) {
    const result = await processVerification(admin, order.id, order.theteller_transaction_id!)
    results.push({ orderId: order.id, ok: result.ok })
  }

  return NextResponse.json({ checked: results.length, results })
}
