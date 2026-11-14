import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkTransactionStatus, isFailedCode } from '@/lib/theteller'
import { processVerification } from '@/lib/payment-verification'

// Polled by the order page while a customer approves a mobile money prompt.
// Returns { state: 'paid' | 'failed' | 'pending' }; confirms or cancels the
// order as soon as TheTeller reports a final result.
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('order_id')
  if (!orderId) return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('status, payment_type, theteller_transaction_id')
    .eq('id', orderId)
    .single()

  if (!order || order.payment_type !== 'theteller' || !order.theteller_transaction_id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.status === 'cancelled' || order.status === 'refunded') {
    return NextResponse.json({ state: 'failed' })
  }
  if (order.status !== 'pending') return NextResponse.json({ state: 'paid' })

  try {
    const status = await checkTransactionStatus(order.theteller_transaction_id)
    if (status.code === '000') {
      const result = await processVerification(admin, orderId, order.theteller_transaction_id)
      return NextResponse.json({ state: result.ok ? 'paid' : 'failed' })
    }
    if (isFailedCode(status.code)) {
      await processVerification(admin, orderId, order.theteller_transaction_id)
      return NextResponse.json({ state: 'failed', reason: status.reason })
    }
    return NextResponse.json({ state: 'pending' })
  } catch (err) {
    console.error('TheTeller status poll error:', err)
    return NextResponse.json({ state: 'pending' })
  }
}
