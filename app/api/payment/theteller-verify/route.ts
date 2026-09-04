import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processVerification } from '@/app/api/payment/verify/route'

// GET — TheTeller redirects the shopper's browser here after checkout,
// appending ?code=&status=&reason=&transaction_id= as query params.
// TheTeller has no inline-popup equivalent to Paystack's, so there is no
// POST handler in this route.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orderId = searchParams.get('order_id')
  const transactionId = searchParams.get('transaction_id')

  if (!orderId || !transactionId) {
    return NextResponse.redirect(new URL('/cart', req.url))
  }

  const admin = createAdminClient()

  try {
    const result = await processVerification(admin, orderId, transactionId)
    if (result.ok) {
      return NextResponse.redirect(new URL(`/orders/${orderId}?success=1`, req.url))
    } else {
      return NextResponse.redirect(new URL(`/orders/${orderId}?error=${result.code ?? 'error'}`, req.url))
    }
  } catch (err) {
    console.error('TheTeller verify error:', err)
    return NextResponse.redirect(new URL(`/orders/${orderId}?error=verify_failed`, req.url))
  }
}
