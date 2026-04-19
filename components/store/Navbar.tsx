'use client'

import Link from 'next/link'
import Logo from '@/components/store/Logo'
import { ShoppingCart } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import NavbarRow1 from './NavbarRow1'
import NavbarRow2 from './NavbarRow2'
import SearchBar from '@/components/store/SearchBar'
import type { Category, TrendingSearch } from '@/lib/supabase/types'

interface NavbarProps {
  categories: Category[]
  trendingSearches: TrendingSearch[]
}

export default function Navbar({ categories, trendingSearches }: NavbarProps) {
  const { count } = useCart()

  useEffect(() => {
    useCart.persist.rehydrate()
  }, [])

  return (
    <motion.header
      className="sticky top-0 z-50"
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Desktop: two-row header */}
      <div className="hidden md:block">
        <NavbarRow1 trendingSearches={trendingSearches} />
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
        </div>
      </div>
    </motion.header>
  )
}
