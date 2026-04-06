'use client'

import Link from 'next/link'
import { ShoppingCart, Search, Heart, User, ChevronDown, Package, LayoutDashboard, LogOut } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { useWishlist } from '@/lib/wishlist'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export default function NavbarRow1() {
  const { count } = useCart()
  const { count: wishlistCount } = useWishlist()
  const [searchQuery, setSearchQuery] = useState('')
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const router = useRouter()
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    useWishlist.persist.rehydrate()
    useCart.persist.rehydrate()
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
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/products?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUserMenuOpen(false)
    router.push('/')
    router.refresh()
  }

  const meta = user?.user_metadata as Record<string, string> | null
  const displayName = meta?.full_name || user?.email?.split('@')[0] || ''
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  return (
    <div className="bg-[#fafaf8]/95 backdrop-blur-sm border-b border-[#ede8df]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-14 gap-4">

          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center gap-2">
            <motion.div
              className="w-8 h-8 rounded-xl bg-[#b45309] text-white flex items-center justify-center font-black text-sm"
              whileHover={{ scale: 1.08, rotate: 4 }}
              whileTap={{ scale: 0.95 }}
            >
              K
            </motion.div>
            <span className="text-[19px] font-extrabold tracking-tight text-[#0a0a0a]">
              Kikuu
            </span>
          </Link>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex flex-1 max-w-xl">
            <div className="relative flex w-full rounded-xl overflow-hidden border border-[#ede8df] focus-within:border-[#b45309] focus-within:ring-2 focus-within:ring-[#b45309]/20 shadow-sm">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search phones, fashion, groceries..."
                className="flex-1 pl-10 pr-3 py-2.5 text-sm outline-none bg-white text-gray-900 placeholder:text-gray-400"
              />
              <button
                type="submit"
                className="px-4 py-2.5 text-xs font-bold bg-[#b45309] hover:bg-[#92400e] text-white transition-colors"
              >
                Search
              </button>
            </div>
          </form>

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
              <div className="relative" ref={userMenuRef}>
                <motion.button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  whileTap={{ scale: 0.95 }}
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
                  <ChevronDown size={13} className={`text-[#6b6360] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </motion.button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-[#ede8df] overflow-hidden z-50"
                    >
                      <div className="px-4 py-3 border-b border-[#f5f0e8]">
                        <p className="font-semibold text-[#0a0a0a] text-sm truncate">{displayName}</p>
                        <p className="text-xs text-[#a89e96] truncate">{user.email}</p>
                      </div>
                      {[
                        { href: '/account', label: 'Dashboard', icon: LayoutDashboard },
                        { href: '/account/orders', label: 'My Orders', icon: Package },
                        { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
                        { href: '/account/profile', label: 'Profile & Addresses', icon: User },
                      ].map(({ href, label, icon: Icon }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-3 text-sm text-[#6b6360] hover:bg-[#fdf6ec] hover:text-[#b45309] transition-colors"
                        >
                          <Icon size={15} className="text-[#a89e96]" />
                          {label}
                        </Link>
                      ))}
                      <div className="border-t border-[#f5f0e8]">
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <LogOut size={15} />
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
