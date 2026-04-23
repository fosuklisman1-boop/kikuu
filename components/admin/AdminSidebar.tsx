'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingBag, Tag, Users, Truck, Megaphone, Ticket, LogOut, ExternalLink, Zap, Building2, TrendingUp, Palette } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/categories', label: 'Categories', icon: Tag },
  { href: '/admin/delivery', label: 'Delivery Fees', icon: Truck },
  { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { href: '/admin/banner', label: 'Banner', icon: Megaphone },
  { href: '/admin/flash-sales', label: 'Flash Sales', icon: Zap },
  { href: '/admin/brands', label: 'Brands', icon: Building2 },
  { href: '/admin/product-options', label: 'Product Options', icon: Palette },
  { href: '/admin/trending-searches', label: 'Trending', icon: TrendingUp },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-60 bg-gray-950 text-gray-400 flex flex-col shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-800">
        <span className="text-white font-extrabold text-xl">
          <span className="text-green-500">Telo</span>Mall
        </span>
        <p className="text-gray-600 text-xs mt-0.5">Admin Panel</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin' ? pathname === href : pathname.startsWith(href)
          return (
            <Link key={href} href={href}>
              <motion.div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
                whileHover={{ x: active ? 0 : 3 }}
                transition={{ duration: 0.15 }}
              >
                <Icon size={16} />
                {label}
                {active && (
                  <motion.div
                    layoutId="active-pill"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-white"
                  />
                )}
              </motion.div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 space-y-1 border-t border-gray-800">
        <Link href="/" target="_blank">
          <motion.div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            whileHover={{ x: 3 }}
          >
            <ExternalLink size={16} />
            View Store
          </motion.div>
        </Link>
        <motion.button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-red-500/10 hover:text-red-400 w-full transition-colors"
          whileHover={{ x: 3 }}
        >
          <LogOut size={16} />
          Sign Out
        </motion.button>
      </div>
    </aside>
  )
}
