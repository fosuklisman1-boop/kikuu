import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processVerification } from '@/lib/payment-verification'

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
