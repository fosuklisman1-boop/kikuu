export const dynamic = 'force-dynamic'
import { getMyShop } from '@/lib/actions/shops'
import { getShopProductsPriced, getShopOrderStats } from '@/lib/actions/shop-products'
import { getWalletBalance, getWithdrawableBalance } from '@/lib/actions/wallet'
import Link from 'next/link'
import { shopUrl } from '@/lib/shop-url'
import { Wallet, PiggyBank, ShoppingBag, Clock, Package } from 'lucide-react'
import { formatGHS } from '@/lib/utils'

export default async function SellerDashboardPage() {
  const shop = await getMyShop()
  if (!shop) return null // layout already redirects if there's no shop; this satisfies TypeScript

  const [products, walletBalance, withdrawable, orderStats] = await Promise.all([
    getShopProductsPriced(),
    getWalletBalance(),
    getWithdrawableBalance(),
    getShopOrderStats(),
  ])

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">{shop.name}</h1>
      <p className="text-sm text-gray-400 mb-6">{shopUrl(shop.slug)}</p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-3">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={14} className="text-gray-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wide">Wallet Balance</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatGHS(walletBalance)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <PiggyBank size={14} className="text-gray-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wide">Withdrawable Now</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatGHS(withdrawable)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag size={14} className="text-gray-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Orders</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{orderStats.total}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-gray-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wide">Pending Orders</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{orderStats.pending}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Package size={14} className="text-gray-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wide">Products in shop</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{products.length}</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-8">
        Pre-order earnings are added to your wallet once the order is marked delivered.
      </p>

      <div className="flex gap-3">
        <Link
          href="/seller/products"
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          Manage Products
        </Link>
        <Link
          href={shopUrl(shop.slug)}
          target="_blank"
          className="border border-gray-300 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors hover:border-green-600"
        >
          View My Shop
        </Link>
      </div>
    </div>
  )
}
