'use client'

import Link from 'next/link'
import { ShoppingCart, Search, Menu, X, Zap, Tag, Grid3X3, ChevronDown, Package, Heart, User, LogOut, LayoutDashboard } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { useWishlist } from '@/lib/wishlist'
import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

const NAV_LINKS = [
  { label: 'All Products', href: '/products', icon: Grid3X3 },
  { label: 'Deals', href: '/products?sort=discount', icon: Zap },
  { label: 'New Arrivals', href: '/products?sort=newest', icon: Tag },
]

export default function Navbar() {
  const { count } = useCart()
  const { count: wishlistCount } = useWishlist()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    useWishlist.persist.rehydrate()
    useCart.persist.rehydrate()
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Close user menu on outside click
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
      setMenuOpen(false)
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
    <motion.header
      className="sticky top-0 z-50 bg-[#fafaf8] border-b border-[#ede8df]"
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center gap-2">
            <motion.div
              className="w-8 h-8 rounded-xl bg-[#b45309] text-white flex items-center justify-center font-black text-sm"
              whileHover={{ scale: 1.08, rotate: 4 }}
              whileTap={{ scale: 0.95 }}
            >
              K
            </motion.div>
            <motion.span className="text-[19px] font-extrabold tracking-tight text-[#0a0a0a] hidden sm:block">
              Kikuu
            </motion.span>
          </Link>

          {/* Search */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-lg">
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
                className="px-4 py-2.5 text-xs font-bold transition-colors flex items-center gap-1.5 bg-[#b45309] hover:bg-[#92400e] text-white"
              >
                Search
              </button>
            </div>
          </form>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV_LINKS.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || (href !== '/products' && pathname.startsWith(href.split('?')[0]))
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-[#fdf6ec] text-[#b45309]'
                      : 'text-[#0a0a0a] hover:bg-[#fdf6ec]'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-1 ml-auto">
            {/* Wishlist */}
            <Link href={user ? '/account/wishlist' : '/account/login?redirect=/account/wishlist'}>
              <motion.div
                className="relative p-2.5 rounded-xl transition-colors duration-200 cursor-pointer hidden md:flex text-[#0a0a0a] hover:bg-[#fdf6ec]"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                title="Wishlist"
              >
                <Heart size={20} />
                <AnimatePresence>
                  {wishlistCount > 0 && (
                    <motion.span
                      key={wishlistCount}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1 -right-1 bg-[#b45309] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
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
                className="relative p-2.5 rounded-xl transition-colors duration-200 cursor-pointer text-[#0a0a0a] hover:bg-[#fdf6ec]"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
              >
                <ShoppingCart size={20} />
                <AnimatePresence>
                  {count > 0 && (
                    <motion.span
                      key={count}
                      initial={{ scale: 0, y: 4 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-1 -right-1 bg-[#b45309] text-white text-[9px] font-extrabold w-[18px] h-[18px] rounded-full flex items-center justify-center shadow-sm"
                    >
                      {count > 9 ? '9+' : count}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>

            {/* User: guest → Sign In button | logged in → avatar dropdown */}
            {user ? (
              <div className="relative hidden md:block" ref={userMenuRef}>
                <motion.button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors duration-200 hover:bg-[#fdf6ec]"
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#b45309] to-[#92400e] flex items-center justify-center text-white text-xs font-extrabold">
                    {initials}
                  </div>
                  <span className="text-sm font-semibold max-w-[80px] truncate text-[#0a0a0a]">
                    {displayName.split(' ')[0]}
                  </span>
                  <ChevronDown size={14} className={`text-[#0a0a0a] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </motion.button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
                    >
                      <div className="px-4 py-3 border-b border-gray-50">
                        <p className="font-semibold text-gray-900 text-sm truncate">{displayName}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
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
                          className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-[#fdf6ec] transition-colors"
                        >
                          <Icon size={15} className="text-[#b45309]" />
                          {label}
                        </Link>
                      ))}
                      <div className="border-t border-gray-50">
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
              <Link href="/account/login" className="hidden md:block">
                <motion.span
                  className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl transition-all cursor-pointer bg-[#b45309] text-white hover:bg-[#92400e]"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <User size={15} />
                  Sign In
                </motion.span>
              </Link>
            )}

            {/* Mobile menu toggle */}
            <motion.button
              className="lg:hidden p-2.5 rounded-xl transition-colors duration-200 text-[#0a0a0a] hover:bg-[#fdf6ec]"
              onClick={() => setMenuOpen(!menuOpen)}
              whileTap={{ scale: 0.9 }}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </motion.button>
          </div>
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden overflow-hidden"
            >
              <div className="pb-4 space-y-2">
                <form onSubmit={handleSearch} className="flex rounded-xl overflow-hidden border border-[#ede8df]">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search products..."
                    className="flex-1 px-4 py-3 text-gray-900 text-sm outline-none bg-white"
                  />
                  <button type="submit" className="bg-[#b45309] text-white px-4">
                    <Search size={16} />
                  </button>
                </form>
                <div className="flex flex-col gap-0.5">
                  {NAV_LINKS.map(({ label, href, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-[#0a0a0a] hover:bg-[#fdf6ec]"
                    >
                      <Icon size={15} />
                      {label}
                    </Link>
                  ))}
                  <div className="border-t border-[#ede8df] mt-1 pt-1">
                    {user ? (
                      <>
                        <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#6b6360]">
                          <div className="w-5 h-5 rounded bg-gradient-to-br from-[#b45309] to-[#92400e] flex items-center justify-center text-white text-[9px] font-extrabold">{initials}</div>
                          {displayName}
                        </div>
                        {[
                          { href: '/account', label: 'Dashboard', icon: LayoutDashboard },
                          { href: '/account/orders', label: 'My Orders', icon: Package },
                          { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
                          { href: '/account/profile', label: 'Profile & Addresses', icon: User },
                        ].map(({ href, label, icon: Icon }) => (
                          <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-[#0a0a0a] hover:bg-[#fdf6ec]">
                            <Icon size={15} /> {label}
                          </Link>
                        ))}
                        <button onClick={() => { handleSignOut(); setMenuOpen(false) }}
                          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50">
                          <LogOut size={15} /> Sign Out
                        </button>
                      </>
                    ) : (
                      <Link href="/account/login" onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-[#0a0a0a] hover:bg-[#fdf6ec]">
                        <User size={15} /> Sign In / Register
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  )
}
