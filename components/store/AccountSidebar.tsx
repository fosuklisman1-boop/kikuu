'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Package, Heart, User, MapPin, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useWishlist } from '@/lib/wishlist'
import { useEffect } from 'react'

const NAV = [
  { href: '/account', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/account/orders', label: 'My Orders', icon: Package },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/profile', label: 'Profile & Addresses', icon: User },
]

interface Props {
  displayName: string
  email: string
  initials: string
}

export default function AccountSidebar({ displayName, email, initials }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { count: wishlistCount, clear: clearWishlist } = useWishlist()

  useEffect(() => {
    useWishlist.persist.rehydrate()
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearWishlist()
    router.push('/')
    router.refresh()
  }

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname?.startsWith(href)
  }

  return (
    <aside className="lg:w-64 shrink-0">
      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#b45309] to-[#92400e] flex items-center justify-center text-white font-extrabold text-base shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">{displayName}</p>
            <p className="text-xs text-gray-400 truncate">{email}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          const badge = label === 'Wishlist' && wishlistCount > 0 ? wishlistCount : null
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-all border-b border-gray-50 last:border-0 ${
                active
                  ? 'bg-[#fdf6ec] text-[#b45309] border-l-2 border-l-[#b45309]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={17} className={active ? 'text-[#b45309]' : 'text-gray-400'} />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          )
        })}

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-all"
        >
          <LogOut size={17} />
          Sign Out
        </button>
      </nav>
    </aside>
  )
}
