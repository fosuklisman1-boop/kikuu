export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { formatGHS } from '@/lib/utils'
import Link from 'next/link'
import { Package, Heart, MapPin, ArrowRight, ShoppingBag } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-600',
}

export default async function AccountDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const meta = user.user_metadata as Record<string, string> | null
  const firstName = (meta?.full_name || 'there').split(' ')[0]
  const savedAddresses: unknown[] = meta?.addresses ? JSON.parse(meta.addresses) : []

  const { data: orders, count } = await supabase
    .from('orders')
    .select('id, order_number, total, status, created_at, items', { count: 'exact' })
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3)

  const totalSpent = (orders ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0)

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-[#b45309] to-[#92400e] rounded-2xl p-6 text-white">
        <p className="text-[#fdf6ec]/80 text-sm mb-1">Welcome back 👋</p>
        <h1 className="text-2xl font-extrabold">{firstName}</h1>
        <p className="text-[#fdf6ec]/70 text-sm mt-1">Manage your orders, wishlist and account details below.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Package, label: 'Total Orders', value: count ?? 0, href: '/account/orders', color: 'text-blue-600 bg-blue-50' },
          { icon: ShoppingBag, label: 'Total Spent', value: formatGHS(totalSpent), href: '/account/orders', color: 'text-[#b45309] bg-[#fdf6ec]' },
          { icon: MapPin, label: 'Saved Addresses', value: savedAddresses.length, href: '/account/profile', color: 'text-purple-600 bg-purple-50' },
        ].map(({ icon: Icon, label, value, href, color }) => (
          <Link key={label} href={href} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center mb-3`}>
              <Icon size={18} />
            </div>
            <p className="text-lg font-extrabold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="font-bold text-gray-900">Recent Orders</h2>
          <Link href="/account/orders" className="text-xs text-[#b45309] font-semibold hover:underline flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {orders && orders.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {orders.map((order) => {
              const itemCount = Array.isArray(order.items) ? (order.items as unknown[]).length : 0
              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <Package size={18} className="text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{order.order_number}</p>
                    <p className="text-xs text-gray-400">
                      {itemCount} item{itemCount !== 1 ? 's' : ''} · {new Date(order.created_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900 text-sm">{formatGHS(order.total)}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-gray-500 text-sm font-medium">No orders yet</p>
            <Link href="/products" className="mt-3 inline-flex items-center gap-1.5 text-[#b45309] text-xs font-semibold hover:underline">
              Start shopping <ArrowRight size={12} />
            </Link>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/account/wishlist" className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <Heart size={18} className="text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">My Wishlist</p>
            <p className="text-xs text-gray-400">Items you love</p>
          </div>
        </Link>
        <Link href="/account/profile" className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
            <MapPin size={18} className="text-purple-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Addresses</p>
            <p className="text-xs text-gray-400">{savedAddresses.length} saved</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
