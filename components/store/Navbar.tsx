'use client'

import Link from 'next/link'
import { ShoppingCart, Search } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import NavbarRow1 from './NavbarRow1'
import NavbarRow2 from './NavbarRow2'
import type { Category } from '@/lib/supabase/types'

interface NavbarProps {
  categories: Category[]
}

export default function Navbar({ categories }: NavbarProps) {
  const { count } = useCart()
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  useEffect(() => {
    useCart.persist.rehydrate()
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/products?q=${encodeURIComponent(searchQuery.trim())}`)
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
        <NavbarRow1 />
        <NavbarRow2 categories={categories} />
      </div>

      {/* Mobile: simplified single-row header */}
      <div className="md:hidden bg-[#fafaf8]/95 backdrop-blur-sm border-b border-[#ede8df]">
        <div className="px-4 flex items-center h-14 gap-3">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <div className="w-8 h-8 rounded-xl bg-[#b45309] text-white flex items-center justify-center font-black text-sm">
              K
            </div>
          </Link>

          {/* Mobile search */}
          <form onSubmit={handleSearch} className="flex-1 flex">
            <div className="relative flex w-full rounded-xl overflow-hidden border border-[#ede8df] focus-within:border-[#b45309] focus-within:ring-2 focus-within:ring-[#b45309]/20">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="flex-1 pl-8 pr-3 py-2 text-sm outline-none bg-white text-gray-900 placeholder:text-gray-400"
              />
            </div>
          </form>

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
