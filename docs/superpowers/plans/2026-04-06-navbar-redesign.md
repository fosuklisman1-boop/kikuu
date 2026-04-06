# Navbar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-row Navbar with a two-row desktop header (logo/search/account + category nav with mega menu) and a persistent mobile bottom tab bar.

**Architecture:** The monolithic `Navbar.tsx` is split into focused subcomponents (`NavbarRow1`, `NavbarRow2`, `MegaMenu`, `BottomTabBar`, `MobileCategoryOverlay`). Categories are fetched server-side in `app/(store)/layout.tsx` and passed as props so the mega menu opens instantly with no client-side fetch. The bottom tab bar is rendered in layout outside `<main>` to avoid scroll interference.

**Tech Stack:** Next.js 16.2.2 App Router, React 19, Tailwind CSS v4, Framer Motion v12, lucide-react, Zustand (cart/wishlist counts), Supabase SSR client

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `components/store/MegaMenu.tsx` | Create | Full-width dropdown panel with 4-column category grid |
| `components/store/NavbarRow2.tsx` | Create | "All Categories" button + Deals/New Arrivals/Pre-orders links; owns mega menu open state |
| `components/store/NavbarRow1.tsx` | Create | Desktop: Logo + Search + Wishlist/Cart/Account |
| `components/store/MobileCategoryOverlay.tsx` | Create | Full-screen slide-up category sheet for mobile |
| `components/store/BottomTabBar.tsx` | Create | Mobile persistent bottom tab bar (Home/Categories/Deals/Wishlist/Account) |
| `components/store/Navbar.tsx` | Rewrite | Thin orchestrator: renders Row1+Row2 on desktop, simplified header on mobile |
| `app/(store)/layout.tsx` | Modify | Fetch all categories server-side, pass to Navbar; render BottomTabBar; add `pb-16 md:pb-0` to main |

---

## Task 1: MegaMenu component

**Files:**
- Create: `components/store/MegaMenu.tsx`

The `Category` type from `lib/supabase/types.ts`:
```ts
type Category = {
  id: string; name: string; slug: string;
  parent_id: string | null; image_url: string | null;
  sort_order: number; created_at: string;
}
```

- [ ] **Step 1: Create `components/store/MegaMenu.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category } from '@/lib/supabase/types'
import { ArrowRight } from 'lucide-react'

interface MegaMenuProps {
  open: boolean
  categories: Category[]
  onClose: () => void
}

export default function MegaMenu({ open, categories, onClose }: MegaMenuProps) {
  // Group: parents (parent_id === null), children keyed by parent_id
  const parents = categories.filter((c) => c.parent_id === null)
  const childrenMap = categories.reduce<Record<string, Category[]>>((acc, c) => {
    if (c.parent_id) {
      acc[c.parent_id] = [...(acc[c.parent_id] ?? []), c]
    }
    return acc
  }, {})

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/20"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-full z-40 bg-white border-b border-[#ede8df] shadow-lg"
          >
            <div className="max-w-7xl mx-auto px-4 py-6">
              {parents.length === 0 ? (
                <Link
                  href="/products"
                  onClick={onClose}
                  className="text-sm text-[#b45309] font-semibold hover:text-[#92400e]"
                >
                  Browse all products →
                </Link>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  {parents.map((parent) => {
                    const children = childrenMap[parent.id] ?? []
                    return (
                      <div key={parent.id}>
                        <Link
                          href={`/products?category=${parent.slug}`}
                          onClick={onClose}
                          className="block text-sm font-bold text-[#b45309] mb-3 hover:text-[#92400e] transition-colors"
                        >
                          {parent.name}
                        </Link>
                        <ul className="space-y-1.5">
                          {children.map((child) => (
                            <li key={child.id}>
                              <Link
                                href={`/products?category=${child.slug}`}
                                onClick={onClose}
                                className="text-sm text-[#6b6360] hover:text-[#b45309] transition-colors"
                              >
                                {child.name}
                              </Link>
                            </li>
                          ))}
                          <li>
                            <Link
                              href={`/products?category=${parent.slug}`}
                              onClick={onClose}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#b45309] hover:text-[#92400e] mt-1 transition-colors"
                            >
                              See all <ArrowRight size={11} />
                            </Link>
                          </li>
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd b:/kikuu && npx tsc --noEmit
```

Expected: no errors related to `MegaMenu.tsx`

- [ ] **Step 3: Commit**

```bash
cd b:/kikuu && git add components/store/MegaMenu.tsx && git commit -m "feat: add MegaMenu component — 4-column category grid with AnimatePresence"
```

---

## Task 2: NavbarRow2 — Category nav bar

**Files:**
- Create: `components/store/NavbarRow2.tsx`

- [ ] **Step 1: Create `components/store/NavbarRow2.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { LayoutGrid, Zap, Tag, Package } from 'lucide-react'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import MegaMenu from './MegaMenu'
import type { Category } from '@/lib/supabase/types'

interface NavbarRow2Props {
  categories: Category[]
}

const NAV_LINKS = [
  { label: 'Deals', href: '/products?sort=discount', icon: Zap },
  { label: 'New Arrivals', href: '/products?sort=newest', icon: Tag },
  { label: 'Pre-orders', href: '/products?status=pre_order', icon: Package },
]

export default function NavbarRow2({ categories }: NavbarRow2Props) {
  const [megaOpen, setMegaOpen] = useState(false)
  const pathname = usePathname()

  // Close mega menu on route change
  useEffect(() => {
    setMegaOpen(false)
  }, [pathname])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMegaOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="relative">
      <div className="bg-white border-b border-[#ede8df]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-10 gap-2">
            {/* All Categories CTA */}
            <button
              onClick={() => setMegaOpen((v) => !v)}
              className="flex items-center gap-2 bg-[#0a0a0a] text-white text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors shrink-0"
            >
              <LayoutGrid size={13} />
              All Categories
            </button>

            <div className="w-px h-4 bg-[#ede8df] mx-1 shrink-0" />

            {/* Static nav links */}
            {NAV_LINKS.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-[#6b6360] hover:text-[#b45309] hover:bg-[#fdf6ec] transition-all whitespace-nowrap"
              >
                <Icon size={12} />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <MegaMenu
        open={megaOpen}
        categories={categories}
        onClose={() => setMegaOpen(false)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd b:/kikuu && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd b:/kikuu && git add components/store/NavbarRow2.tsx && git commit -m "feat: add NavbarRow2 — category nav bar with All Categories mega menu trigger"
```

---

## Task 3: NavbarRow1 — Desktop identity + search + account

**Files:**
- Create: `components/store/NavbarRow1.tsx`

This component handles the top row on desktop: Logo, Search, Wishlist/Cart/Account icons with labels.

- [ ] **Step 1: Create `components/store/NavbarRow1.tsx`**

```tsx
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
            <span className="text-[19px] font-extrabold tracking-tight text-[#0a0a0a] hidden sm:block">
              Kikuu
            </span>
          </Link>

          {/* Search — desktop only */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl">
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

          {/* Account icons — desktop only */}
          <div className="hidden md:flex items-center gap-1 ml-auto">

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
                      className="absolute top-0.5 right-1.5 bg-[#b45309] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
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
                      className="absolute top-0.5 right-1.5 bg-[#b45309] text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-sm"
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
                <motion.span
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl cursor-pointer text-[#6b6360] hover:bg-[#fdf6ec] transition-colors"
                >
                  <User size={18} />
                  <span className="text-[10px] font-medium">Sign In</span>
                </motion.span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd b:/kikuu && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd b:/kikuu && git add components/store/NavbarRow1.tsx && git commit -m "feat: add NavbarRow1 — desktop logo/search/account row with icon labels"
```

---

## Task 4: MobileCategoryOverlay — Full-screen category sheet

**Files:**
- Create: `components/store/MobileCategoryOverlay.tsx`

- [ ] **Step 1: Create `components/store/MobileCategoryOverlay.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category } from '@/lib/supabase/types'

interface MobileCategoryOverlayProps {
  open: boolean
  categories: Category[]
  onClose: () => void
}

export default function MobileCategoryOverlay({ open, categories, onClose }: MobileCategoryOverlayProps) {
  const parents = categories.filter((c) => c.parent_id === null)
  const childrenMap = categories.reduce<Record<string, Category[]>>((acc, c) => {
    if (c.parent_id) {
      acc[c.parent_id] = [...(acc[c.parent_id] ?? []), c]
    }
    return acc
  }, {})

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed inset-0 z-50 bg-white overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-[#ede8df] px-4 py-4 flex items-center justify-between">
            <h2 className="font-extrabold text-[#0a0a0a] text-lg">Categories</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#f5f2ed] text-[#6b6360] hover:bg-[#ede8df] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Category list */}
          <div className="px-4 py-6 space-y-8">
            {parents.length === 0 ? (
              <Link
                href="/products"
                onClick={onClose}
                className="text-sm text-[#b45309] font-semibold"
              >
                Browse all products →
              </Link>
            ) : (
              parents.map((parent) => {
                const children = childrenMap[parent.id] ?? []
                return (
                  <div key={parent.id}>
                    <Link
                      href={`/products?category=${parent.slug}`}
                      onClick={onClose}
                      className="block text-sm font-bold text-[#b45309] mb-3 hover:text-[#92400e]"
                    >
                      {parent.name}
                    </Link>
                    <div className="grid grid-cols-2 gap-2">
                      {children.map((child) => (
                        <Link
                          key={child.id}
                          href={`/products?category=${child.slug}`}
                          onClick={onClose}
                          className="text-sm text-[#6b6360] py-2 px-3 rounded-lg bg-[#f5f2ed] hover:bg-[#fdf6ec] hover:text-[#b45309] transition-colors"
                        >
                          {child.name}
                        </Link>
                      ))}
                      <Link
                        href={`/products?category=${parent.slug}`}
                        onClick={onClose}
                        className="text-xs font-semibold text-[#b45309] py-2 px-3 rounded-lg border border-[#b45309]/20 hover:bg-[#fdf6ec] transition-colors"
                      >
                        See all →
                      </Link>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd b:/kikuu && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd b:/kikuu && git add components/store/MobileCategoryOverlay.tsx && git commit -m "feat: add MobileCategoryOverlay — full-screen slide-up category sheet"
```

---

## Task 5: BottomTabBar — Mobile persistent navigation

**Files:**
- Create: `components/store/BottomTabBar.tsx`

- [ ] **Step 1: Create `components/store/BottomTabBar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { Home, LayoutGrid, Zap, Heart, User } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/lib/supabase/types'
import MobileCategoryOverlay from './MobileCategoryOverlay'

interface BottomTabBarProps {
  categories: Category[]
}

export default function BottomTabBar({ categories }: BottomTabBarProps) {
  const pathname = usePathname()
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setIsLoggedIn(!!data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session?.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Close overlay on route change
  useEffect(() => {
    setCategoryOpen(false)
  }, [pathname])

  const tabs = [
    { label: 'Home', icon: Home, href: '/' as string | null, action: null as (() => void) | null },
    { label: 'Categories', icon: LayoutGrid, href: null, action: () => setCategoryOpen(true) },
    { label: 'Deals', icon: Zap, href: '/products?sort=discount', action: null },
    { label: 'Wishlist', icon: Heart, href: isLoggedIn ? '/account/wishlist' : '/account/login?redirect=/account/wishlist', action: null },
    { label: 'Account', icon: User, href: isLoggedIn ? '/account' : '/account/login', action: null },
  ]

  return (
    <>
      <MobileCategoryOverlay
        open={categoryOpen}
        categories={categories}
        onClose={() => setCategoryOpen(false)}
      />

      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-[#ede8df]"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex h-16">
          {tabs.map(({ label, icon: Icon, href, action }) => {
            const isActive = href !== null && (
              href === '/' ? pathname === '/' : pathname.startsWith(href.split('?')[0])
            )
            const activeClass = isActive ? 'text-[#b45309]' : 'text-[#a89e96]'

            const content = (
              <span className={`flex flex-col items-center gap-1 ${activeClass}`}>
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
```

- [ ] **Step 2: Type-check**

```bash
cd b:/kikuu && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd b:/kikuu && git add components/store/BottomTabBar.tsx && git commit -m "feat: add BottomTabBar — mobile persistent bottom nav with category overlay"
```

---

## Task 6: Navbar orchestrator rewrite

**Files:**
- Modify: `components/store/Navbar.tsx`

Replace the current 351-line monolith with a thin orchestrator. Desktop renders Row1 + Row2. Mobile renders a simplified header (logo + search + cart only — wishlist/account are in the bottom tab bar).

- [ ] **Step 1: Overwrite `components/store/Navbar.tsx`**

```tsx
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

          {/* Cart icon (mobile) */}
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
```

- [ ] **Step 2: Type-check**

```bash
cd b:/kikuu && npx tsc --noEmit
```

Expected: error about `Navbar` being called without `categories` prop in layout.tsx — that's expected; we fix it in Task 7.

- [ ] **Step 3: Commit**

```bash
cd b:/kikuu && git add components/store/Navbar.tsx && git commit -m "feat: rewrite Navbar as thin orchestrator — desktop two-row, mobile simplified header"
```

---

## Task 7: Layout — Wire categories, BottomTabBar, and main padding

**Files:**
- Modify: `app/(store)/layout.tsx`

This is the only server component in the chain. It fetches all categories (parents + children in one query), passes them to `Navbar` and `BottomTabBar`, and adds `pb-16 md:pb-0` to `<main>` to prevent the bottom tab bar from overlapping content.

- [ ] **Step 1: Overwrite `app/(store)/layout.tsx`**

```tsx
import Navbar from '@/components/store/Navbar'
import Footer from '@/components/store/Footer'
import AnnouncementBar from '@/components/store/AnnouncementBar'
import BottomTabBar from '@/components/store/BottomTabBar'
import { createClient } from '@/lib/supabase/server'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')

  const cats = categories ?? []

  return (
    <>
      <AnnouncementBar />
      <Navbar categories={cats} />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
      <BottomTabBar categories={cats} />
    </>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd b:/kikuu && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run dev server and visually verify**

```bash
cd b:/kikuu && npm run dev
```

Check:
- Desktop (≥768px): two-row header visible — Row 1 has logo/search/account, Row 2 has "All Categories" + Deals/New Arrivals/Pre-orders
- Clicking "All Categories" opens mega menu with 4-column grid and backdrop
- Mega menu closes on Escape, outside click, and route change
- Mobile (<768px): single-row header with logo/search/cart; bottom tab bar pinned at bottom
- Tapping "Categories" tab on mobile opens full-screen slide-up overlay
- Page content is not obscured by the bottom tab bar (pb-16 working)

- [ ] **Step 4: Commit**

```bash
cd b:/kikuu && git add "app/(store)/layout.tsx" && git commit -m "feat: wire Navbar + BottomTabBar in layout, fetch categories server-side"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Row 1: Logo + Search + Wishlist/Cart/Account with labels | Task 3 (NavbarRow1) |
| Row 2: "All Categories" dark CTA + Deals/New/Pre-orders | Task 2 (NavbarRow2) |
| Mega menu: 4-column, DB-driven, AnimatePresence | Task 1 (MegaMenu) |
| Mega menu closes on outside click, Escape, route change | Task 2 (NavbarRow2) |
| Fallback if categories empty: "Browse all products →" | Task 1 (MegaMenu) |
| Categories fetched server-side in layout | Task 7 (layout.tsx) |
| Subcategories grouped client-side by parent_id | Task 1 (MegaMenu) |
| Mobile: simplified header (logo + search + cart only) | Task 6 (Navbar) |
| Mobile: bottom tab bar (Home/Categories/Deals/Wishlist/Account) | Task 5 (BottomTabBar) |
| Mobile Categories tab → full-screen overlay | Tasks 4+5 |
| Active tab: amber color | Task 5 (BottomTabBar) |
| main gets pb-16 md:pb-0 to avoid overlap | Task 7 (layout.tsx) |
| sticky top-0 z-50 for header | Task 6 (Navbar) |
| Wishlist/Account tab redirect to login if not authenticated | Task 5 (BottomTabBar) |
| Safe-area-inset-bottom for iOS notch | Task 5 (BottomTabBar) |
| Mega menu z-index: z-40, header z-50, tab bar z-50 | Tasks 1, 6, 5 |

All spec requirements covered. No placeholders. Type names consistent throughout (`Category` from `@/lib/supabase/types`, `categories: Category[]` prop in all consumers).
