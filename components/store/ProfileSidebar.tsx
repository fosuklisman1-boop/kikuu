'use client'

import Link from 'next/link'
import { LayoutDashboard, Package, Heart, User, LogOut, Store, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const NAV = [
  { href: '/account', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/account/orders', label: 'My Orders', icon: Package },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/profile', label: 'Profile & Addresses', icon: User },
]

interface ProfileSidebarProps {
  displayName: string
  email: string
  initials: string
  wishlistCount: number
  shopHref: string
  shopLabel: string
  open: boolean
  onClose: () => void
}

export default function ProfileSidebar({
  displayName,
  email,
  initials,
  wishlistCount,
  shopHref,
  shopLabel,
  open,
  onClose,
}: ProfileSidebarProps) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    onClose()
    router.push('/')
    router.refresh()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/40"
          />
          <motion.aside
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed top-0 right-0 bottom-0 z-[60] w-80 max-w-[85vw] bg-[#fafaf8] flex flex-col shadow-2xl"
          >
            <div className="px-5 py-5 border-b border-[#ede8df] flex items-center gap-3 shrink-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#b45309] to-[#92400e] flex items-center justify-center text-white font-extrabold text-sm shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#0a0a0a] text-sm truncate">{displayName}</p>
                <p className="text-xs text-[#a89e96] truncate">{email}</p>
              </div>
              <button onClick={onClose} className="text-[#a89e96] hover:text-[#0a0a0a] p-1 rounded-lg transition-colors" aria-label="Close menu">
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto">
              {NAV.map(({ href, label, icon: Icon }) => {
                const badge = label === 'Wishlist' && wishlistCount > 0 ? wishlistCount : null
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-[#6b6360] hover:bg-[#fdf6ec] hover:text-[#b45309] transition-colors border-b border-[#f5f0e8]"
                  >
                    <Icon size={17} className="text-[#a89e96]" />
                    <span className="flex-1">{label}</span>
                    {badge && (
                      <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </Link>
                )
              })}
              <Link
                href={shopHref}
                onClick={onClose}
                className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-[#b45309] hover:bg-[#fdf6ec] transition-colors border-b border-[#f5f0e8]"
              >
                <Store size={17} className="text-[#b45309]" />
                {shopLabel}
              </Link>
            </nav>

            <div className="p-3 border-t border-[#ede8df] shrink-0">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
