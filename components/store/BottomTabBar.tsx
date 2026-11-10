'use client'

import Link from 'next/link'
import { Home, ShoppingBag, Clock, Heart, User } from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
export default function BottomTabBar() {
  const pathname = usePathname()
  const onPreorderTab = useSearchParams().get('tab') === 'preorder'
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
    { label: 'Home', icon: Home, href: '/' as string | null, action: null as (() => void) | null },
    { label: 'Available', icon: ShoppingBag, href: '/products', action: null },
    { label: 'Pre-order', icon: Clock, href: '/products?tab=preorder', action: null },
    { label: 'Wishlist', icon: Heart, href: isLoggedIn ? '/account/wishlist' : '/account/login?redirect=/account/wishlist', action: null },
    { label: 'Account', icon: User, href: isLoggedIn ? '/account' : '/account/login', action: null },
  ]

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-[#ede8df]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-16">
          {tabs.map(({ label, icon: Icon, href, action }) => {
            const isProducts = pathname === '/products'
            const isActive = href !== null && (
              label === 'Available' ? isProducts && !onPreorderTab
              : label === 'Pre-order' ? isProducts && onPreorderTab
              : href === '/' ? pathname === '/' : pathname.startsWith(href.split('?')[0])
            )
            const colorClass = isActive ? 'text-[#b45309]' : 'text-[#a89e96]'

            const content = (
              <span className={`flex flex-col items-center gap-1 ${colorClass}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[10px] font-semibold">{label}</span>
              </span>
            )

            if (action) {
              return (
                <button
                  key={label}
                  onClick={action}
                  className="flex-1 flex items-center justify-center"
                >
                  {content}
                </button>
              )
            }

            return (
              <Link
                key={label}
                href={href!}
                className="flex-1 flex items-center justify-center"
              >
                {content}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
