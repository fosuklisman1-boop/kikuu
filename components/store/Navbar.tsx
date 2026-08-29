'use client'

import Link from 'next/link'
import Logo from '@/components/store/Logo'
import { ShoppingCart, Menu } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { useWishlist } from '@/lib/wishlist'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import NavbarRow1 from './NavbarRow1'
import NavbarRow2 from './NavbarRow2'
import SearchBar from '@/components/store/SearchBar'
import type { Category, TrendingSearch } from '@/lib/supabase/types'
import ProfileSidebar from '@/components/store/ProfileSidebar'
import { getMyShop } from '@/lib/actions/shops'

interface NavbarProps {
  categories: Category[]
  trendingSearches: TrendingSearch[]
}

export default function Navbar({ categories, trendingSearches }: NavbarProps) {
  const { count } = useCart()
  const { count: wishlistCount } = useWishlist()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [shop, setShop] = useState<{ slug: string } | null>(null)

  useEffect(() => {
    useCart.persist.rehydrate()
    useWishlist.persist.rehydrate()
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShop(null)
      return
    }
    getMyShop().then((s) => setShop(s ? { slug: s.slug } : null))
  }, [user])

  const meta = user?.user_metadata as Record<string, string> | null
  const displayName = meta?.full_name || user?.email?.split('@')[0] || ''
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  function handleMenuTrigger() {
    if (user) {
      setUserMenuOpen(true)
    } else {
      window.location.href = '/account/login'
    }
  }

  return (
    <motion.header
      className="sticky top-0 z-50"
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Desktop: two-row header */}
      <div className="hidden md:block">
        <NavbarRow1
          trendingSearches={trendingSearches}
          user={user}
          displayName={displayName}
          initials={initials}
          onOpenUserMenu={() => setUserMenuOpen(true)}
        />
        <NavbarRow2 categories={categories} />
      </div>

      {/* Mobile: simplified single-row header */}
      <div className="md:hidden bg-[#fafaf8]/95 backdrop-blur-sm border-b border-[#ede8df]">
        <div className="px-4 flex items-center h-14 gap-3">
          {/* Logo */}
          <Logo size="xs" />

          {/* Mobile search */}
          <div className="flex-1">
            <SearchBar trendingSearches={trendingSearches} />
          </div>

          {/* Cart icon */}
          <Link href="/cart" className="relative shrink-0">
            <ShoppingCart size={22} className="text-[#6b6360]" />
            <AnimatePresence>
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className="absolute -top-1.5 -right-1.5 bg-[#b45309] text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center"
                >
                  {count > 9 ? '9+' : count}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          {/* Menu / profile trigger */}
          <button
            onClick={handleMenuTrigger}
            className="shrink-0 text-[#6b6360] p-0.5"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {user && (
        <ProfileSidebar
          displayName={displayName}
          email={user.email ?? ''}
          initials={initials}
          wishlistCount={wishlistCount}
          shopHref={shop ? '/seller/dashboard' : '/seller/onboarding'}
          shopLabel={shop ? 'My Shop' : 'Sell on Kikuu'}
          open={userMenuOpen}
          onClose={() => setUserMenuOpen(false)}
        />
      )}
    </motion.header>
  )
}
