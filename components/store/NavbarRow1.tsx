'use client'

import Link from 'next/link'
import Logo from '@/components/store/Logo'
import { ShoppingCart, Heart, User } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { useWishlist } from '@/lib/wishlist'
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import SearchBar from '@/components/store/SearchBar'
import type { TrendingSearch } from '@/lib/supabase/types'

interface NavbarRow1Props {
  trendingSearches: TrendingSearch[]
  user: SupabaseUser | null
  displayName: string
  initials: string
  onOpenUserMenu: () => void
}

export default function NavbarRow1({ trendingSearches, user, displayName, initials, onOpenUserMenu }: NavbarRow1Props) {
  const { count } = useCart()
  const { count: wishlistCount } = useWishlist()

  useEffect(() => {
    useWishlist.persist.rehydrate()
    useCart.persist.rehydrate()
  }, [])

  return (
    <div className="bg-[#fafaf8]/95 backdrop-blur-sm border-b border-[#ede8df]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-14 gap-4">

          {/* Logo */}
          <Logo size="sm" />

          {/* Search */}
          <div className="flex flex-1 max-w-xl">
            <SearchBar trendingSearches={trendingSearches} />
          </div>

          {/* Account icons */}
          <div className="flex items-center gap-1 ml-auto">

            {/* Wishlist */}
            <Link href={user ? '/account/wishlist' : '/account/login?redirect=/account/wishlist'}>
              <motion.div
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}
                className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl cursor-pointer text-[#6b6360] hover:bg-[#fdf6ec] transition-colors"
              >
                <Heart size={18} />
                <span className="text-[10px] font-medium">Wishlist</span>
                <AnimatePresence>
                  {wishlistCount > 0 && (
                    <motion.span
                      key={wishlistCount}
                      initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                      className="absolute top-0.5 right-1 bg-[#b45309] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
                    >
                      {wishlistCount > 9 ? '9+' : wishlistCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>

            {/* Cart */}
            <Link href="/cart">
              <motion.div
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}
                className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl cursor-pointer text-[#6b6360] hover:bg-[#fdf6ec] transition-colors"
              >
                <ShoppingCart size={18} />
                <span className="text-[10px] font-medium">Cart</span>
                <AnimatePresence>
                  {count > 0 && (
                    <motion.span
                      key={count}
                      initial={{ scale: 0, y: 4 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute top-0.5 right-1 bg-[#b45309] text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-sm"
                    >
                      {count > 9 ? '9+' : count}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>

            {/* User */}
            {user ? (
              <button
                onClick={onOpenUserMenu}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#fdf6ec] transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#b45309] to-[#92400e] flex items-center justify-center text-white text-xs font-extrabold">
                  {initials}
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[10px] text-[#a89e96] leading-none">Hello,</span>
                  <span className="text-xs font-semibold text-[#0a0a0a] max-w-[72px] truncate leading-tight">
                    {displayName.split(' ')[0]}
                  </span>
                </div>
              </button>
            ) : (
              <Link href="/account/login">
                <motion.div
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl cursor-pointer text-[#6b6360] hover:bg-[#fdf6ec] transition-colors"
                >
                  <User size={18} />
                  <span className="text-[10px] font-medium">Sign In</span>
                </motion.div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
