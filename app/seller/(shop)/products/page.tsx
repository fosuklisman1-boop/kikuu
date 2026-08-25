export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { getMyShop } from '@/lib/actions/shops'
import { getShopProductsPriced } from '@/lib/actions/shop-products'
import SellerProductsClient from '@/components/seller/SellerProductsClient'

export default async function SellerProductsPage() {
  const shop = await getMyShop()
  if (!shop) return null // layout already redirects if there's no shop

  const supabase = await createClient()
  const [{ data: products }, curated] = await Promise.all([
    supabase.from('products').select('*').eq('status', 'active').order('name'),
    getShopProductsPriced(shop.id),
  ])

  const curatedIds = new Set(curated.map((c) => c.product_id))
  const availableToAdd = (products ?? []).filter((p) => !curatedIds.has(p.id))

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Your Products</h1>
      <SellerProductsClient availableProducts={availableToAdd} curatedItems={curated} />
    </div>
  )
}
