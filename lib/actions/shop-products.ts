'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireShopOwner } from '@/lib/auth/require-shop-owner'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ShopProductPriced, Product } from '@/lib/supabase/types'

const MarkupSchema = z.object({
  markupType: z.enum(['flat', 'percentage']),
  markupValue: z.coerce.number().min(0),
})

export async function addShopProducts(input: {
  productIds: string[]
  markupType: 'flat' | 'percentage'
  markupValue: number
}): Promise<{ error?: string }> {
  const { shopId } = await requireShopOwner()

  const parsed = MarkupSchema.safeParse({ markupType: input.markupType, markupValue: input.markupValue })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid markup.' }
  if (input.productIds.length === 0) return { error: 'Select at least one product.' }

  const admin = createAdminClient()
  const rows = input.productIds.map((productId) => ({
    shop_id: shopId,
    product_id: productId,
    markup_type: parsed.data.markupType,
    markup_value: parsed.data.markupValue,
  }))

  const { error } = await admin
    .from('shop_products')
    .upsert(rows, { onConflict: 'shop_id,product_id' })

  if (error) return { error: error.message }

  revalidatePath('/seller/products')
  return {}
}

export async function updateShopProductMarkup(
  shopProductId: string,
  markupType: 'flat' | 'percentage',
  markupValue: number
): Promise<{ error?: string }> {
  const { shopId } = await requireShopOwner()

  const parsed = MarkupSchema.safeParse({ markupType, markupValue })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid markup.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('shop_products')
    .update({ markup_type: parsed.data.markupType, markup_value: parsed.data.markupValue })
    .eq('id', shopProductId)
    .eq('shop_id', shopId)

  if (error) return { error: error.message }

  revalidatePath('/seller/products')
  return {}
}

export async function removeShopProduct(shopProductId: string): Promise<{ error?: string }> {
  const { shopId } = await requireShopOwner()

  const admin = createAdminClient()
  const { error } = await admin
    .from('shop_products')
    .delete()
    .eq('id', shopProductId)
    .eq('shop_id', shopId)

  if (error) return { error: error.message }

  revalidatePath('/seller/products')
  return {}
}

export async function getShopProductsPriced(shopId: string): Promise<ShopProductPriced[]> {
  const admin = createAdminClient()
  const { data: priced } = await admin
    .from('shop_products_priced')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })

  if (!priced || priced.length === 0) return []

  const productIds = priced.map((p) => p.product_id)
  const { data: products } = await admin
    .from('products')
    .select('*')
    .in('id', productIds)

  const productMap = new Map((products ?? []).map((p: Product) => [p.id, p]))

  return priced
    .map((p) => {
      const product = productMap.get(p.product_id)
      if (!product) return null
      return { ...p, product } as ShopProductPriced
    })
    .filter((p): p is ShopProductPriced => p !== null)
}
