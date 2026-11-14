'use client'

import Link from 'next/link'
import { Home, ShoppingCart, Package, User } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Mobile tab bar for a single shop: only shop home + shared checkout/account
// areas. No catalog, pre-order or wishlist tabs (those are marketplace-wide).
export default function ShopBottomTabBar({ home }: { home: string }) {
  const pathname = usePathname()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setIsLoggedIn(!!data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session?.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  const tabs = [
    { label: 'Shop', icon: Home, href: home, active: pathname === home || (home !== '/' && pathname.startsWith(`${home}/`)) },
    { label: 'Cart', icon: ShoppingCart, href: '/cart', active: pathname.startsWith('/cart') },
    {
      label: 'Orders', icon: Package,
      href: isLoggedIn ? '/account/orders' : '/account/login?redirect=/account/orders',
      active: pathname.startsWith('/account/orders') || pathname.startsWith('/orders'),
    },
    {
      label: 'Account', icon: User,
      href: isLoggedIn ? '/account' : '/account/login',
      active: pathname === '/account' || pathname.startsWith('/account/login') || pathname.startsWith('/account/profile'),
    },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-[#ede8df]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-16">
        {tabs.map(({ label, icon: Icon, href, active }) => (
          <Link key={label} href={href} className="flex-1 flex items-center justify-center">
            <span className={`flex flex-col items-center gap-1 ${active ? 'text-[#b45309]' : 'text-[#a89e96]'}`}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-semibold">{label}</span>
            </span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
