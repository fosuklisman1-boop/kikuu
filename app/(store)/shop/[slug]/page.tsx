export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ShopProductCard from '@/components/store/ShopProductCard'
import type { Metadata } from 'next'
import type { Product } from '@/lib/supabase/types'
import { headers } from 'next/headers'
import { getShopSlugFromHost } from '@/lib/shop-subdomain'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: shop } = await supabase.from('shops').select('name').eq('slug', slug).eq('active', true).single()
  return { title: shop?.name ?? 'Shop' }
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!shop) notFound()

  const host = (await headers()).get('host') ?? ''
  const onSubdomain = getShopSlugFromHost(host, process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? '') === shop.slug

  const { data: priced } = await supabase
    .from('shop_products_priced')
    .select('*')
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: false })

  const productIds = (priced ?? []).map((p) => p.product_id)
  const { data: products } = productIds.length
    ? await supabase.from('products').select('*').in('id', productIds).in('status', ['active', 'pre_order'])
    : { data: [] as Product[] }

  const productMap = new Map((products ?? []).map((p) => [p.id, p]))
  const items = (priced ?? [])
    .map((p) => {
      const product = productMap.get(p.product_id)
      return product ? { ...p, product } : null
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{shop.name}</h1>
      <p className="text-sm text-gray-400 mb-6">{items.length} product{items.length === 1 ? '' : 's'}</p>

      {items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {items.map((item) => (
            <ShopProductCard key={item.id} shopId={shop.id} shopSlug={shop.slug} item={item} onSubdomain={onSubdomain} />
          ))}
        </div>
      ) : (
        <div className="text-center py-28 text-gray-400">
          <p className="text-4xl mb-4">🛍️</p>
          <p className="font-medium text-gray-600">This shop hasn&apos;t added any products yet.</p>
        </div>
      )}
    </div>
  )
}
