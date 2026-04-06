export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatGHS } from '@/lib/utils'
import AddToCartButton from '@/components/store/AddToCartButton'
import ProductImages from '@/components/store/ProductImages'
import { CalendarClock } from 'lucide-react'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: product } = await supabase
    .from('products')
    .select('name, description')
    .eq('slug', slug)
    .single()

  return {
    title: (product as any)?.name ?? 'Product',
    description: (product as any)?.description ?? undefined,
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: product } = await supabase
    .from('products')
    .select('*, categories(name, slug)')
    .eq('slug', slug)
    .in('status', ['active', 'pre_order'])
    .single() as { data: any; error: any }

  if (!product) notFound()

  const isPreorder = product.status === 'pre_order'
  const inStock = product.stock_qty > 0 || isPreorder
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price
  const discountPct = hasDiscount
    ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
    : 0

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-10">
        <ProductImages images={product.images} name={product.name} />

        <div>
          <p className="text-sm text-green-600 mb-1">
            {product.categories?.name}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{product.name}</h1>

          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-bold text-gray-900">
              {formatGHS(product.price)}
            </span>
            {hasDiscount && (
              <>
                <span className="text-lg text-gray-400 line-through">
                  {formatGHS(product.compare_at_price)}
                </span>
                <span className="text-sm font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded">
                  -{discountPct}%
                </span>
              </>
            )}
          </div>

          {/* Stock / pre-order badge */}
          <div className="mb-6">
            {isPreorder ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-orange-50 text-orange-700">
                <CalendarClock size={14} />
                Pre-order
              </span>
            ) : (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                inStock ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {inStock ? `In Stock (${product.stock_qty} left)` : 'Out of Stock'}
              </span>
            )}
          </div>

          {/* Pre-order info block */}
          {isPreorder && product.preorder_ship_date && (
            <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-6">
              <CalendarClock size={16} className="text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-800">Pre-order Item</p>
                <p className="text-xs text-orange-600 mt-0.5">
                  Expected to ship by {new Date(product.preorder_ship_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-orange-500 mt-0.5">Payment is collected on delivery.</p>
              </div>
            </div>
          )}

          {product.description && (
            <p className="text-gray-600 text-sm mb-8">{product.description}</p>
          )}

          <AddToCartButton product={product} disabled={!inStock} />

          <div className="mt-8 border-t pt-6 space-y-2 text-sm text-gray-500">
            <p>Delivery across all Ghana regions</p>
            {isPreorder
              ? <p>Pre-orders are paid on delivery when your item ships.</p>
              : <p>Pay with MTN MoMo, Vodafone Cash, Card, or Bank Transfer</p>
            }
            <p>Secure checkout powered by Paystack</p>
          </div>
        </div>
      </div>
    </div>
  )
}
