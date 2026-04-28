'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingBag, Tag, Users, Truck, Megaphone, Ticket, LogOut, ExternalLink, Zap, Building2, TrendingUp, Palette, Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

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

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div>
          <span className="text-white font-extrabold text-xl">
            <span className="text-green-500">Telo</span>Mall
          </span>
          <p className="text-gray-600 text-xs mt-0.5">Admin Panel</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin' ? pathname === href : pathname.startsWith(href)
          return (
            <Link key={href} href={href} onClick={onClose}>
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
      <div className="p-3 space-y-1 border-t border-gray-800 shrink-0">
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
    </>
  )
}

export default function AdminSidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const currentPage = NAV.find((n) =>
    n.href === '/admin' ? pathname === n.href : pathname.startsWith(n.href)
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 bg-gray-950 text-gray-400 flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-gray-950 flex items-center px-4 gap-3 border-b border-gray-800">
        <button
          onClick={() => setOpen(true)}
          className="text-gray-400 hover:text-white p-1.5 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <span className="text-white font-extrabold text-lg leading-none">
          <span className="text-green-500">Telo</span>Mall
        </span>
        {currentPage && (
          <span className="text-gray-500 text-sm ml-1">/ {currentPage.label}</span>
        )}
      </div>

      {/* Mobile drawer + backdrop */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="lg:hidden fixed inset-0 z-50 bg-black/60"
            />
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-gray-950 text-gray-400 flex flex-col"
            >
              <SidebarContent onClose={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
