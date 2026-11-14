'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { slugify } from '@/lib/utils'
import { creditShopEarnings, reverseShopEarnings } from '@/lib/wallet-ledger'
import { getFlashSalePriceMap } from '@/lib/actions/flash-sales'
import type { Product } from '@/lib/supabase/types'
import { isDeliveryStatus, legacyForDelivery, DELIVERY_LABELS } from '@/lib/order-status'
import { z } from 'zod'

// A blank form field means "use the default" (stored as NULL downstream). Plain
// z.coerce.number() would turn '' into 0 — a real override — so blank/missing is
// mapped to '' *before* the numeric schema runs.
function blankOrNumber(schema: z.ZodType<number>) {
  return z.preprocess(
    (v) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? '' : v),
    z.union([z.literal(''), schema]),
  ) as z.ZodType<number | ''>
}

const ProductSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().optional(),
  category_id: z.string().uuid(),
  price: z.coerce.number().positive(),
  compare_at_price: z.coerce.number().positive().optional().or(z.literal('')),
  stock_qty: z.coerce.number().int().min(0),
  status: z.enum(['active', 'draft', 'out_of_stock', 'pre_order']),
  featured: z.coerce.boolean().default(false),
  preorder_days: z.coerce.number().int().min(1).optional().or(z.literal('')),
  preorder_note: z.string().max(150).optional(),
  min_order_qty: z.coerce.number().int().min(1).optional().or(z.literal('')),
  max_order_qty: z.coerce.number().int().min(1).optional().or(z.literal('')),
  below_min_topup: blankOrNumber(z.coerce.number().min(0)),
  attributes: z.string().optional(),
  commission_percent: blankOrNumber(z.coerce.number().min(0).max(100)),
}).refine(
  (data) => data.status !== 'pre_order' || !!data.preorder_days,
  { message: 'Days until delivery is required for pre-order products', path: ['preorder_days'] }
).refine(
  (data) => !data.min_order_qty || !data.max_order_qty || Number(data.max_order_qty) >= Number(data.min_order_qty),
  { message: 'Maximum order quantity must be greater than or equal to the minimum', path: ['max_order_qty'] }
)

export async function createProduct(formData: FormData) {
  await requireAdmin()
  const raw = Object.fromEntries(formData)
  const parsed = ProductSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { compare_at_price, preorder_days, preorder_note, min_order_qty, max_order_qty, below_min_topup, commission_percent, attributes: attributesJson, ...rest } = parsed.data
  let attributes: Record<string, unknown> = {}
  if (attributesJson) {
    try { attributes = JSON.parse(attributesJson) } catch {
      return { error: { _: ['Invalid attributes data. Please try again.'] } }
    }
  }
  const admin = createAdminClient()

  const images = formData.getAll('images').filter(Boolean) as string[]
  const videos = formData.getAll('videos').filter(Boolean) as string[]

  const { data, error } = await admin.from('products').insert({
    ...rest,
    compare_at_price: compare_at_price || null,
    commission_percent: commission_percent === '' || commission_percent === undefined ? null : Number(commission_percent),
    preorder_days: rest.status === 'pre_order' ? (Number(preorder_days) || null) : null,
    preorder_note: rest.status === 'pre_order' ? (preorder_note || null) : null,
    min_order_qty: rest.status === 'pre_order' ? (Number(min_order_qty) || null) : null,
    max_order_qty: rest.status === 'pre_order' ? (Number(max_order_qty) || null) : null,
    below_min_topup: rest.status === 'pre_order' && below_min_topup !== '' && below_min_topup !== undefined ? Number(below_min_topup) : null,
    images,
    videos,
    slug: slugify(rest.name),
    attributes,
  }).select().single()

  if (error) {
    if (error.code === '23505') return { error: { name: ['A product with this name already exists.'] } }
    return { error: { _: [error.message] } }
  }

  revalidatePath('/admin/products')
  revalidatePath('/')
  redirect(`/admin/products`)
}

export async function updateProduct(id: string, formData: FormData) {
  await requireAdmin()
  const raw = Object.fromEntries(formData)
  const parsed = ProductSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { compare_at_price, preorder_days, preorder_note, min_order_qty, max_order_qty, below_min_topup, commission_percent, attributes: attributesJson, ...rest } = parsed.data
  let attributes: Record<string, unknown> = {}
  if (attributesJson) {
    try { attributes = JSON.parse(attributesJson) } catch {
      return { error: { _: ['Invalid attributes data. Please try again.'] } }
    }
  }
  const admin = createAdminClient()
  const images = formData.getAll('images').filter(Boolean) as string[]
  const videos = formData.getAll('videos').filter(Boolean) as string[]

  const { error } = await admin.from('products').update({
    ...rest,
    compare_at_price: compare_at_price || null,
    commission_percent: commission_percent === '' || commission_percent === undefined ? null : Number(commission_percent),
    preorder_days: rest.status === 'pre_order' ? (Number(preorder_days) || null) : null,
    preorder_note: rest.status === 'pre_order' ? (preorder_note || null) : null,
    min_order_qty: rest.status === 'pre_order' ? (Number(min_order_qty) || null) : null,
    max_order_qty: rest.status === 'pre_order' ? (Number(max_order_qty) || null) : null,
    below_min_topup: rest.status === 'pre_order' && below_min_topup !== '' && below_min_topup !== undefined ? Number(below_min_topup) : null,
    images,
    videos,
    slug: slugify(rest.name),
    attributes,
  }).eq('id', id)

  if (error) return { error: { _: [error.message] } }

  revalidatePath('/admin/products')
  revalidatePath('/')
  redirect('/admin/products')
}

export async function deleteProduct(id: string) {
  await requireAdmin()
  const admin = createAdminClient()
  await admin.from('products').delete().eq('id', id)
  revalidatePath('/admin/products')
  revalidatePath('/')
}

// Admin moves a PAID order through delivery. Payment status is never edited
// here — gateways set it, and refundOrder reverses it.
export async function updateDeliveryStatus(orderId: string, status: string) {
  await requireAdmin()
  if (!isDeliveryStatus(status)) return { error: 'Invalid delivery status' }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('payment_status, delivery_status')
    .eq('id', orderId)
    .single()

  if (!order) return { error: 'Order not found' }
  if (order.payment_status !== 'paid') return { error: 'Only paid orders can be updated.' }
  if (order.delivery_status === status) return { success: true }

  const { error } = await admin
    .from('orders')
    .update({ delivery_status: status, status: legacyForDelivery(status) })
    .eq('id', orderId)
  if (error) return { error: error.message }

  // Shop earnings are credited on delivery (re-verified as paid inside).
  if (status === 'delivered') await creditShopEarnings(orderId)

  await admin.from('order_events').insert({
    order_id: orderId,
    event: `Delivery updated to ${DELIVERY_LABELS[status]}`,
    description: `Admin set delivery status to "${DELIVERY_LABELS[status]}".`,
  })

  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/admin/orders')
  revalidatePath('/admin')
  return { success: true }
}

// Admin-only: reverse a paid order. Payment becomes 'refunded' and any seller
// earnings already credited for it are reversed.
export async function refundOrder(orderId: string) {
  await requireAdmin()
  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('shop_id, payment_status')
    .eq('id', orderId)
    .single()

  if (!order) return { error: 'Order not found' }
  if (order.payment_status !== 'paid') return { error: 'Only paid orders can be refunded.' }

  const { error } = await admin
    .from('orders')
    .update({ payment_status: 'refunded', status: 'refunded' })
    .eq('id', orderId)
    .eq('payment_status', 'paid')
  if (error) return { error: error.message }

  if (order.shop_id) await reverseShopEarnings(orderId)

  await admin.from('order_events').insert({
    order_id: orderId,
    event: 'Refunded',
    description: 'Admin refunded this order.',
  })

  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/admin/orders')
  revalidatePath('/admin')
  return { success: true }
}

export async function uploadProductVideo(formData: FormData) {
  await requireAdmin()
  const file = formData.get('file') as File
  if (!file) return { error: 'No file provided' }

  const allowed = ['video/mp4', 'video/webm', 'video/quicktime']
  if (!allowed.includes(file.type)) return { error: 'Only MP4, WebM, MOV allowed' }
  if (file.size > 50 * 1024 * 1024) return { error: 'Max video size is 50MB' }

  const admin = createAdminClient()
  const ext = file.name.split('.').pop()
  const path = `videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await admin.storage.from('product-images').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) return { error: error.message }

  const { data: { publicUrl } } = admin.storage
    .from('product-images')
    .getPublicUrl(path)

  return { url: publicUrl }
}

export async function uploadProductImage(formData: FormData) {
  await requireAdmin()
  const file = formData.get('file') as File
  if (!file) return { error: 'No file provided' }

  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) return { error: 'Only JPG, PNG, WebP allowed' }
  if (file.size > 5 * 1024 * 1024) return { error: 'Max file size is 5MB' }

  const admin = createAdminClient()
  const ext = file.name.split('.').pop()
  const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await admin.storage.from('product-images').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) return { error: error.message }

  const { data: { publicUrl } } = admin.storage
    .from('product-images')
    .getPublicUrl(path)

  return { url: publicUrl }
}

const PRODUCTS_PAGE_SIZE = 20

export interface ProductsPageFilters {
  tab: 'available' | 'preorder'
  query?: string
  categorySlug?: string
  brandSlug?: string
  featuredOnly?: boolean
}

// Public read — mirrors app/(store)/products/page.tsx's server-rendered
// first page exactly, so infinite scroll never produces a different set
// or order of products than a fresh page load would.
export async function fetchProductsPage(
  filters: ProductsPageFilters,
  page: number
): Promise<{ products: Product[]; salePrices: Record<string, number>; hasMore: boolean }> {
  const supabase = await createClient()
  const from = (page - 1) * PRODUCTS_PAGE_SIZE

  let categoryId: string | null = null
  if (filters.categorySlug) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', filters.categorySlug)
      .single()
    categoryId = cat?.id ?? null
  }

  let brandId: string | null = null
  if (filters.brandSlug) {
    const { data: brandRow } = await supabase
      .from('brands')
      .select('id')
      .eq('slug', filters.brandSlug)
      .eq('active', true)
      .maybeSingle()
    brandId = brandRow?.id ?? null
  }

  const status = filters.tab === 'preorder' ? 'pre_order' : 'active'
  let q = supabase
    .from('products')
    .select('*, categories(below_min_topup)', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (filters.query) q = q.textSearch('search_vector', filters.query)
  if (categoryId) q = q.eq('category_id', categoryId)
  if (brandId) q = q.eq('brand_id', brandId)
  if (filters.featuredOnly) q = q.eq('featured', true)

  const { data: products, count } = await q.range(from, from + PRODUCTS_PAGE_SIZE - 1)
  const salePrices = await getFlashSalePriceMap((products ?? []).map((p) => p.id))
  const hasMore = (count ?? 0) > from + (products?.length ?? 0)

  return { products: products ?? [], salePrices, hasMore }
}

// Move several paid orders to one delivery step. Each order is checked
// individually (unpaid ones are skipped and reported).
export async function bulkUpdateDeliveryStatus(orderIds: string[], status: string) {
  await requireAdmin()
  if (!isDeliveryStatus(status)) return { error: 'Invalid delivery status' }
  if (!orderIds.length || orderIds.length > 100) return { error: 'Select between 1 and 100 orders.' }

  let updated = 0
  const failed: string[] = []
  for (const id of orderIds) {
    const res = await updateDeliveryStatus(id, status)
    if (res && 'error' in res && res.error) failed.push(id)
    else updated++
  }
  return { updated, failed: failed.length }
}
