export const dynamic = 'force-dynamic'
import { getMyShop } from '@/lib/actions/shops'
import { getShopProductsPriced } from '@/lib/actions/shop-products'
import Link from 'next/link'

export default async function SellerDashboardPage() {
  const shop = await getMyShop()
  if (!shop) return null // layout already redirects if there's no shop; this satisfies TypeScript

  const products = await getShopProductsPriced(shop.id)

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">{shop.name}</h1>
      <p className="text-sm text-gray-400 mb-6">/shop/{shop.slug}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Products in shop</p>
          <p className="text-2xl font-bold text-gray-900">{products.length}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href="/seller/products"
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          Manage Products
        </Link>
        <Link
          href={`/shop/${shop.slug}`}
          target="_blank"
          className="border border-gray-300 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors hover:border-green-600"
        >
          View My Shop
        </Link>
      </div>
    </div>
  )
}
