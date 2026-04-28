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
  payment_type: z.literal('paystack').default('paystack'),
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().min(1),
      selected_color: z.object({
        name: z.string().max(100),
        hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }).optional(),
      selected_size: z.string().max(20).optional(),
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

    const { email, address, items: rawItems, coupon_code } = parsed.data
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
        .select('id, name, price, images, stock_qty, status, preorder_days, preorder_note')
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

    const orderDate = new Date()
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

      // Compute delivery date for pre-order items at purchase time
      let itemPreorderShipDate: string | null = null
      if (product.status === 'pre_order' && product.preorder_days) {
        const d = new Date(orderDate)
        d.setDate(d.getDate() + product.preorder_days)
        itemPreorderShipDate = d.toISOString().split('T')[0]
      }

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        product_image: product.images[0] ?? '',
        price: flashPrices.get(product.id) ?? product.price,
        quantity: raw.quantity,
        is_preorder: product.status === 'pre_order',
        preorder_ship_date: itemPreorderShipDate,
        preorder_note: product.preorder_note ?? null,
        selected_color: raw.selected_color,
        selected_size: raw.selected_size,
      })
    }

    // Determine pre-order metadata
    const hasPreorder = orderItems.some((i) => i.is_preorder)
    const preorderDates = orderItems
      .filter((i) => i.is_preorder && i.preorder_ship_date)
      .map((i) => i.preorder_ship_date!)
      .sort()
    const latestPreorderDate = preorderDates.at(-1) ?? null

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
          if (coupon.type === 'free_shipping') {
            discountAmount = shippingFee
          } else {
            discountAmount =
              coupon.type === 'percentage'
                ? Math.round((subtotal * coupon.value) / 100 * 100) / 100
                : Math.min(coupon.value, subtotal)
          }
          appliedCouponId = coupon.id
          appliedCouponUsedCount = coupon.used_count
        }
      }
    }

    const total = subtotal + shippingFee - discountAmount

    // Create order in DB — all orders go through Paystack, always start as pending
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
        status: 'pending',
        payment_type: 'paystack',
        payment_status: 'pending',
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

    const eventDescription = hasPreorder
      ? `Pre-order placed, awaiting payment.${latestPreorderDate ? ` Expected delivery: ${latestPreorderDate}.` : ''}`
      : 'Your order has been placed and is awaiting payment.'

    await admin.from('order_events').insert({
      order_id: order.id,
      event: 'Order Placed',
      description: eventDescription,
    })

    // Initialize Paystack payment
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
