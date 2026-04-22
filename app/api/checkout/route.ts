import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { initializePayment, generateReference } from '@/lib/paystack'
import type { OrderItem } from '@/lib/supabase/types'
import { SHIPPING_FEES } from '@/lib/utils'
import { z } from 'zod'

const AddressSchema = z.object({
  recipient_name: z.string().min(2),
  phone: z.string().min(9),
  region: z.string().min(2),
  district: z.string().min(2),
  city: z.string().min(2),
  landmark: z.string().min(2),
  digital_address: z.string().optional(),
})

const CheckoutSchema = z.object({
  email: z.string().email(),
  address: AddressSchema,
  coupon_code: z.string().optional(),
  payment_type: z.enum(['paystack', 'cod']).default('paystack'),
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().min(1),
    })
  ).min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = CheckoutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { email, address, items: rawItems, coupon_code, payment_type } = parsed.data
    const supabase = await createClient()
    const admin = createAdminClient()

    // Get authenticated user if any
    const { data: { user } } = await supabase.auth.getUser()

    // Validate products and compute prices — include pre_order status
    const productIds = rawItems.map((i) => i.product_id)
    const now = new Date().toISOString()

    // Fetch products and active flash sale in parallel
    const [{ data: products, error: productsError }, { data: activeSale }] = await Promise.all([
      admin
        .from('products')
        .select('id, name, price, images, stock_qty, status, preorder_ship_date')
        .in('id', productIds)
        .in('status', ['active', 'pre_order']),
      admin
        .from('flash_sales')
        .select('id')
        .eq('active', true)
        .lte('starts_at', now)
        .gt('ends_at', now)
        .maybeSingle(),
    ])

    if (productsError || !products) {
      return NextResponse.json({ error: 'Failed to load products' }, { status: 500 })
    }

    // Fetch flash sale prices for cart products (only if a sale is active)
    const flashPrices = new Map<string, number>()
    if (activeSale) {
      const { data: saleItems } = await admin
        .from('flash_sale_items')
        .select('product_id, sale_price')
        .eq('flash_sale_id', activeSale.id)
        .in('product_id', productIds)
      for (const item of saleItems ?? []) {
        flashPrices.set(item.product_id, item.sale_price)
      }
    }

    const orderItems: OrderItem[] = []
    for (const raw of rawItems) {
      const product = products.find((p) => p.id === raw.product_id)
      if (!product) {
        return NextResponse.json({ error: `Product not found: ${raw.product_id}` }, { status: 400 })
      }
      // Skip stock check for pre-order products
      if (product.status !== 'pre_order' && product.stock_qty < raw.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${product.name}` }, { status: 400 })
      }
      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        product_image: product.images[0] ?? '',
        price: flashPrices.get(product.id) ?? product.price,
        quantity: raw.quantity,
        is_preorder: product.status === 'pre_order',
        preorder_ship_date: product.preorder_ship_date ?? null,
      })
    }

    // Determine pre-order metadata
    const hasPreorder = orderItems.some((i) => i.is_preorder)
    const preorderDates = orderItems
      .filter((i) => i.is_preorder && i.preorder_ship_date)
      .map((i) => i.preorder_ship_date!)
      .sort()
    const latestPreorderDate = preorderDates.at(-1) ?? null

    // Pre-order items must use COD
    if (hasPreorder && payment_type === 'paystack') {
      return NextResponse.json(
        { error: 'Pre-order items require payment on delivery. Please select "Pay on Delivery".' },
        { status: 400 }
      )
    }

    const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0)

    // Fetch shipping fee from DB, fall back to hardcoded if table missing/empty
    const { data: feeRow } = await admin
      .from('delivery_fees')
      .select('fee, enabled')
      .eq('region', address.region)
      .single()

    let shippingFee: number
    if (feeRow) {
      if (!feeRow.enabled) {
        return NextResponse.json({ error: `Delivery is not available for ${address.region}` }, { status: 400 })
      }
      shippingFee = Number(feeRow.fee)
    } else {
      shippingFee = SHIPPING_FEES[address.region] ?? 50
    }

    // Validate coupon — keep coupon id so we can increment used_count after order creation
    let discountAmount = 0
    let appliedCouponId: string | null = null
    let appliedCouponUsedCount = 0
    if (coupon_code) {
      const { data: coupon } = await admin
        .from('coupons')
        .select('*')
        .eq('code', coupon_code.toUpperCase())
        .eq('active', true)
        .single()

      if (coupon) {
        const notExpired = !coupon.expires_at || new Date(coupon.expires_at) > new Date()
        const underLimit = !coupon.max_uses || coupon.used_count < coupon.max_uses
        const meetsMin = !coupon.min_order_amount || subtotal >= coupon.min_order_amount

        if (notExpired && underLimit && meetsMin) {
          discountAmount =
            coupon.type === 'percentage'
              ? Math.round((subtotal * coupon.value) / 100 * 100) / 100
              : Math.min(coupon.value, subtotal)
          appliedCouponId = coupon.id
          appliedCouponUsedCount = coupon.used_count
        }
      }
    }

    const total = subtotal + shippingFee - discountAmount

    // Determine initial status and payment_status
    const isCod = payment_type === 'cod'
    const initialStatus = isCod ? 'confirmed' : 'pending'
    const initialPaymentStatus = isCod ? 'awaiting_cod' : 'pending'

    // Create order in DB
    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        buyer_id: user?.id ?? null,
        buyer_email: email,
        buyer_phone: address.phone,
        buyer_name: address.recipient_name,
        shipping_address: address as unknown as any,
        items: orderItems as unknown as any,
        subtotal,
        shipping_fee: shippingFee,
        discount_amount: discountAmount,
        total,
        status: initialStatus,
        payment_type,
        payment_status: initialPaymentStatus,
        is_preorder: hasPreorder,
        pre_order_ship_date: latestPreorderDate,
        order_number: '', // set by trigger
      })
      .select()
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    // Increment coupon usage count now that the order is committed.
    // We use used_count + 1 from the value read at validation time — low race risk
    // for a small store, and avoids needing a custom DB function.
    if (appliedCouponId) {
      await admin
        .from('coupons')
        .update({ used_count: appliedCouponUsedCount + 1 })
        .eq('id', appliedCouponId)
    }

    // Initial order event
    let eventDescription: string
    if (hasPreorder && isCod) {
      eventDescription = `Pre-order placed. Payment collected on delivery.${latestPreorderDate ? ` Expected ship date: ${latestPreorderDate}.` : ''}`
    } else if (isCod) {
      eventDescription = 'Order placed. Payment will be collected on delivery.'
    } else {
      eventDescription = 'Your order has been placed and is awaiting payment.'
    }

    await admin.from('order_events').insert({
      order_id: order.id,
      event: 'Order Placed',
      description: eventDescription,
    })

    // COD path: for non-pre-order COD, decrement stock immediately (stock is reserved)
    if (isCod && !hasPreorder) {
      for (const item of orderItems) {
        await admin.rpc('decrement_stock', {
          p_product_id: item.product_id,
          p_qty: item.quantity,
        })
      }
    }

    // COD: return immediately with no payment URL
    if (isCod) {
      return NextResponse.json({
        order_id: order.id,
        order_number: order.order_number,
        payment_url: null,
      })
    }

    // Paystack path: initialize payment
    const reference = generateReference(order.id)
    let payment
    try {
      payment = await initializePayment({
        email,
        amount: total,
        reference,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/verify?order_id=${order.id}`,
        metadata: { order_id: order.id, order_number: order.order_number },
      })
    } catch (paystackErr: any) {
      console.error('Paystack init error:', paystackErr)
      // Cancel the order so it doesn't sit as a ghost pending order
      await admin.from('orders').delete().eq('id', order.id)
      return NextResponse.json(
        { error: paystackErr?.message ?? 'Payment provider error. Please try again.' },
        { status: 502 }
      )
    }

    const { error: refError } = await admin
      .from('orders')
      .update({ paystack_reference: reference })
      .eq('id', order.id)

    if (refError) {
      console.error('Failed to save paystack_reference:', refError)
      await admin.from('orders').delete().eq('id', order.id)
      return NextResponse.json({ error: 'Failed to save payment reference. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({
      order_id: order.id,
      order_number: order.order_number,
      access_code: payment.access_code,
      reference,
      total,
    })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
