'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { slugify } from '@/lib/utils'
import { z } from 'zod'

const ProductSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().optional(),
  category_id: z.string().uuid(),
  price: z.coerce.number().positive(),
  compare_at_price: z.coerce.number().positive().optional().or(z.literal('')),
  stock_qty: z.coerce.number().int().min(0),
  status: z.enum(['active', 'draft', 'out_of_stock', 'pre_order']),
  featured: z.coerce.boolean().default(false),
  preorder_ship_date: z.string().optional().or(z.literal('')),
  attributes: z.string().optional(),
}).refine(
  (data) => data.status !== 'pre_order' || !!data.preorder_ship_date,
  { message: 'Expected ship date is required for pre-order products', path: ['preorder_ship_date'] }
)

export async function createProduct(formData: FormData) {
  const raw = Object.fromEntries(formData)
  const parsed = ProductSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { compare_at_price, preorder_ship_date, attributes: attributesJson, ...rest } = parsed.data
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
    preorder_ship_date: rest.status === 'pre_order' ? (preorder_ship_date || null) : null,
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
  const raw = Object.fromEntries(formData)
  const parsed = ProductSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { compare_at_price, preorder_ship_date, attributes: attributesJson, ...rest } = parsed.data
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
    preorder_ship_date: rest.status === 'pre_order' ? (preorder_ship_date || null) : null,
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
  const admin = createAdminClient()
  await admin.from('products').delete().eq('id', id)
  revalidatePath('/admin/products')
  revalidatePath('/')
}

export async function updateOrderStatus(orderId: string, status: string) {
  const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']
  if (!validStatuses.includes(status)) return { error: 'Invalid status' }

  const admin = createAdminClient()

  // Fetch order to check for pre-order items before updating
  const { data: order } = await admin
    .from('orders')
    .select('is_preorder, items')
    .eq('id', orderId)
    .single()

  const { error } = await admin.from('orders').update({ status }).eq('id', orderId)
  if (error) return { error: error.message }

  await admin.from('order_events').insert({
    order_id: orderId,
    event: `Status updated to ${status}`,
    description: `Admin updated order status to "${status}".`,
  })

  // Decrement stock for pre-order items when admin moves order to processing
  // (this is when items are physically pulled from inventory)
  if (status === 'processing' && order?.is_preorder) {
    const items = (order.items as { product_id: string; quantity: number; is_preorder: boolean }[]) ?? []
    for (const item of items) {
      if (item.is_preorder) {
        await admin.rpc('decrement_stock', {
          p_product_id: item.product_id,
          p_qty: item.quantity,
        })
      }
    }
  }

  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/admin/orders')
  return { success: true }
}

export async function confirmCodPayment(orderId: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('orders')
    .update({ payment_status: 'paid', status: 'delivered' })
    .eq('id', orderId)
    .eq('payment_type', 'cod')

  if (error) return { error: error.message }

  await admin.from('order_events').insert({
    order_id: orderId,
    event: 'Payment Collected',
    description: 'Cash on delivery payment confirmed by admin.',
  })

  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/admin/orders')
  return { success: true }
}

export async function uploadProductVideo(formData: FormData) {
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
