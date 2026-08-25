export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatGHS } from '@/lib/utils'
import ProductImages from '@/components/store/ProductImages'
import ProductVariantSection from '@/components/store/ProductVariantSection'
import type { Metadata } from 'next'
import type { ProductAttributes } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ slug: string; productSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { productSlug } = await params
  const supabase = await createClient()
  const { data: product } = await supabase
    .from('products')
    .select('name, description')
    .eq('slug', productSlug)
    .single()
  return { title: (product as any)?.name ?? 'Product', description: (product as any)?.description ?? undefined }
}

export default async function ShopProductPage({ params }: Props) {
  const { slug, productSlug } = await params
  const supabase = await createClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!shop) notFound()

  const { data: product } = await supabase
    .from('products')
    .select('*, categories(name, slug)')
    .eq('slug', productSlug)
    .eq('status', 'active')
    .single() as { data: any }

  if (!product) notFound()

  const { data: shopProduct } = await supabase
    .from('shop_products_priced')
    .select('*')
    .eq('shop_id', shop.id)
    .eq('product_id', product.id)
    .single()

  if (!shopProduct) notFound()

  const isPreorder = product.status === 'pre_order'
  const inStock = product.stock_qty > 0 || isPreorder
  const attrs = (product.attributes ?? {}) as ProductAttributes
  const variantColors = attrs.colors ?? []
  const variantSizes = attrs.sizes ?? []

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
      <div className="grid md:grid-cols-2 gap-6 md:gap-10">
        <div className="min-w-0">
          <ProductImages images={product.images} videos={product.videos ?? []} name={product.name} />
        </div>

        <div className="min-w-0">
          <p className="text-sm text-green-600 mb-1">{shop.name}</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{product.name}</h1>

          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-bold text-gray-900">{formatGHS(shopProduct.shop_price)}</span>
          </div>

          <div className="mb-6">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                inStock ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {inStock ? `In Stock (${product.stock_qty} left)` : 'Out of Stock'}
            </span>
          </div>

          {product.description && <p className="text-gray-600 text-sm mb-8">{product.description}</p>}

          <ProductVariantSection
            product={product}
            disabled={!inStock}
            shopPrice={shopProduct.shop_price}
            shopId={shop.id}
            shopSlug={shop.slug}
            variantColors={variantColors}
            variantSizes={variantSizes}
          />
        </div>
      </div>
    </div>
  )
}
