export const dynamic = 'force-dynamic'
import { getMyShop } from '@/lib/actions/shops'
import { getShopProductsPriced } from '@/lib/actions/shop-products'
import { getShopSales, type SaleCommissionStatus } from '@/lib/actions/shop-sales'
import CopyLinkButton from '@/components/seller/CopyLinkButton'
import { shopUrl, shopProductUrl } from '@/lib/shop-url'
import { formatGHS } from '@/lib/utils'
import { Banknote, Hourglass, TrendingUp } from 'lucide-react'

export const metadata = { title: 'Links & Sales' }

const STATUS_STYLES: Record<SaleCommissionStatus, { label: string; className: string }> = {
  earned: { label: 'Earned', className: 'bg-green-50 text-green-700 border-green-200' },
  pending: { label: 'Pending', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  reversed: { label: 'Reversed', className: 'bg-red-50 text-red-700 border-red-200' },
}

export default async function SellerLinksPage() {
  const shop = await getMyShop()
  if (!shop) return null // layout already redirects if there's no shop

  const [products, summary] = await Promise.all([getShopProductsPriced(), getShopSales()])
  const shopLink = shopUrl(shop.slug)

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Links &amp; Sales</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-gray-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Sales</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatGHS(summary.totalSales)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Banknote size={14} className="text-gray-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wide">Commission Earned</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatGHS(summary.earned)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Hourglass size={14} className="text-gray-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wide">Pending Commission</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatGHS(summary.pending)}</p>
          <p className="text-xs text-gray-400 mt-1">Pre-orders pay out once delivered.</p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Your shop link</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3">
          <span className="text-sm text-gray-700 truncate">{shopLink}</span>
          <CopyLinkButton url={shopLink} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Product links</h2>
        {products.length === 0 ? (
          <p className="text-sm text-gray-400">Add products to your shop to get shareable links.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {products.map((item) => {
              const link = shopProductUrl(shop.slug, item.product.slug)
              return (
                <div key={item.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.product.name}</p>
                    <p className="text-xs text-gray-400 truncate">{link}</p>
                    <p className="text-xs text-green-600 mt-0.5">
                      {item.commission_percent}% commission · {formatGHS(Math.round(item.shop_price * item.commission_percent) / 100)} per unit
                    </p>
                  </div>
                  <CopyLinkButton url={link} />
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Sales &amp; commissions</h2>
        {summary.sales.length === 0 ? (
          <p className="text-sm text-gray-400">No paid sales yet. Share your links to get started.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200">
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Items</th>
                  <th className="py-3 pr-4">Sale</th>
                  <th className="py-3 pr-4">Commission</th>
                  <th className="py-3 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.sales.map((sale) => {
                  const style = STATUS_STYLES[sale.status]
                  return (
                    <tr key={sale.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 px-4 font-medium text-gray-800">{sale.order_number}</td>
                      <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                        {new Date(sale.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {sale.items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ')}
                      </td>
                      <td className="py-3 pr-4 text-gray-700">{formatGHS(sale.sale_amount)}</td>
                      <td className="py-3 pr-4 font-semibold text-gray-900">{formatGHS(sale.commission)}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${style.className}`}>
                          {style.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
