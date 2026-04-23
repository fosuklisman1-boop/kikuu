# Kikuu UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the green-dominant UI with a clean minimal style using warm amber accent, DM Sans typography, and floating-shadow product cards across all customer-facing pages.

**Architecture:** Targeted file-by-file rewrites. No new files created — every change is an edit to an existing component or page. Design tokens live in `globals.css`; all components consume them via Tailwind arbitrary values matching the spec.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS 4, Framer Motion, DM Sans (Google Fonts)

---

## File Map

| File | Change |
|---|---|
| `app/layout.tsx` | Swap Sora → DM Sans |
| `app/globals.css` | Add amber tokens, remove green tokens, update scrollbar/focus |
| `components/store/Navbar.tsx` | Remove scroll color-change, always-light amber |
| `components/store/AnnouncementBar.tsx` | Green dot → amber |
| `components/store/Footer.tsx` | Green → amber throughout |
| `components/store/HeroBanner.tsx` | Full rewrite — amber gradient banner |
| `components/store/ProductCard.tsx` | Full rewrite — floating shadow card |
| `components/store/CategoryGrid.tsx` | Unified amber image area, remove per-category colors |
| `app/(store)/page.tsx` | Update Why Kikuu, Promo Banner, Newsletter, Payment strip |
| `app/(store)/cart/page.tsx` | Green → amber sweep |
| `components/store/CartItem.tsx` | Green price → amber |
| `app/(store)/account/(dashboard)/page.tsx` | Green welcome banner → amber, link colors |
| `components/store/CheckoutForm.tsx` | Input focus ring, button color |

---

## Task 1: Design Tokens + DM Sans Font

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Swap font in `app/layout.tsx`**

Replace the entire file:

```tsx
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Kikuu — Shop Ghana",
    template: "%s | Kikuu",
  },
  description:
    "Shop the best products delivered across Ghana. Electronics, fashion, home goods and more.",
  keywords: ["ghana", "online shopping", "ecommerce", "accra", "kumasi"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${dmSans.variable} font-sans min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Update design tokens in `app/globals.css`**

Replace the `:root` block and update all green references:

```css
@import "tailwindcss";

/* ── Brand tokens ─────────────────────────────────── */
:root {
  --bg:               #fafaf8;
  --surface:          #ffffff;
  --border:           #ede8df;
  --border-soft:      #f5f1eb;
  --text-primary:     #0a0a0a;
  --text-muted:       #6b6360;
  --text-subtle:      #a89e96;
  --accent:           #b45309;
  --accent-hover:     #92400e;
  --accent-light:     #fdf6ec;
  --accent-mid:       #faecd8;
  --shadow-card:      0 1px 3px rgba(0,0,0,.05), 0 4px 16px rgba(0,0,0,.06);
  --shadow-hover:     0 2px 6px rgba(0,0,0,.04), 0 12px 36px rgba(0,0,0,.10);
  --shadow-float:     0 8px 40px rgba(0,0,0,.14);
}

/* ── Reset & base ────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }

body {
  background: var(--bg);
  color: var(--text-primary);
  font-family: var(--font-dm-sans, system-ui, sans-serif);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
}

/* ── Scrollbar ───────────────────────────────────── */
::-webkit-scrollbar        { width: 5px; height: 5px; }
::-webkit-scrollbar-track  { background: transparent; }
::-webkit-scrollbar-thumb  { background: #d4c9bc; border-radius: 99px; }
::-webkit-scrollbar-thumb:hover { background: var(--accent); }

/* ── Focus ring ──────────────────────────────────── */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

/* ── Surface & glass ─────────────────────────────── */
.glass {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.22);
}

/* ── Shimmer ─────────────────────────────────────── */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.shimmer {
  background: linear-gradient(90deg, #f5f1eb 25%, #ece7df 50%, #f5f1eb 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}

/* ── Marquee ─────────────────────────────────────── */
@keyframes marquee {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.marquee-track {
  animation: marquee 32s linear infinite;
  display: inline-flex;
}
.marquee-track:hover { animation-play-state: paused; }

/* ── Slide up reveal ─────────────────────────────── */
@keyframes slide-up-reveal {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.slide-reveal {
  animation: slide-up-reveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* ── Shine sweep ─────────────────────────────────── */
@keyframes shine {
  0%   { left: -100%; }
  100% { left:  150%; }
}
.shine-on-hover {
  position: relative;
  overflow: hidden;
}
.shine-on-hover::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0; width: 45%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  left: -100%;
}
.shine-on-hover:hover::after {
  animation: shine 0.5s ease forwards;
}

/* ── Card lift ───────────────────────────────────── */
.card-hover {
  transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.28s ease;
}
.card-hover:hover {
  transform: translateY(-4px) scale(1.005);
  box-shadow: var(--shadow-hover);
}

/* ── Cursor blink ────────────────────────────────── */
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.cursor-blink::after {
  content: '|';
  animation: blink 1s step-end infinite;
  margin-left: 2px;
  color: var(--accent);
}

/* ── Pulse ring ──────────────────────────────────── */
@keyframes pulse-ring {
  0%   { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(2);   opacity: 0; }
}
```

- [ ] **Step 3: Verify in browser**

Open http://localhost:3000. The page background should be `#fafaf8` and font should be DM Sans (geometric, slightly condensed). No visual breakage expected yet.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: add DM Sans font and amber design tokens"
```

---

## Task 2: Navbar

**Files:**
- Modify: `components/store/Navbar.tsx`

- [ ] **Step 1: Replace Navbar**

Replace the entire `components/store/Navbar.tsx` file:

```tsx
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
      className="sticky top-0 z-50 bg-[#fafaf8]/95 backdrop-blur-xl border-b border-[#ede8df] shadow-[0_1px_0_rgba(0,0,0,0.04)]"
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center gap-2">
            <motion.div
              className="w-8 h-8 rounded-xl bg-[#b45309] flex items-center justify-center font-black text-sm text-white"
              whileHover={{ scale: 1.08, rotate: 4 }}
              whileTap={{ scale: 0.95 }}
            >
              K
            </motion.div>
            <span className="text-[19px] font-extrabold tracking-tight text-[#0a0a0a] hidden sm:block">
              Kikuu
            </span>
          </Link>

          {/* Search */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-lg">
            <div className="relative flex w-full rounded-xl overflow-hidden border border-[#ede8df] focus-within:border-[#b45309] focus-within:ring-2 focus-within:ring-[#b45309]/15 shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#a89e96]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search phones, fashion, groceries..."
                className="flex-1 pl-10 pr-3 py-2.5 text-sm outline-none bg-white text-[#0a0a0a] placeholder:text-[#a89e96]"
              />
              <button
                type="submit"
                className="px-4 py-2.5 text-xs font-bold bg-[#b45309] hover:bg-[#92400e] text-white transition-colors"
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
                      : 'text-[#6b6360] hover:bg-[#f5f1eb] hover:text-[#0a0a0a]'
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
                className="relative p-2.5 rounded-xl text-[#6b6360] hover:bg-[#f5f1eb] hover:text-[#0a0a0a] transition-colors cursor-pointer hidden md:flex"
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
                className="relative p-2.5 rounded-xl text-[#6b6360] hover:bg-[#f5f1eb] hover:text-[#0a0a0a] transition-colors cursor-pointer"
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

            {/* User */}
            {user ? (
              <div className="relative hidden md:block" ref={userMenuRef}>
                <motion.button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#f5f1eb] transition-colors"
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="w-7 h-7 rounded-lg bg-[#b45309] flex items-center justify-center text-white text-xs font-extrabold">
                    {initials}
                  </div>
                  <span className="text-sm font-semibold max-w-[80px] truncate text-[#0a0a0a]">
                    {displayName.split(' ')[0]}
                  </span>
                  <ChevronDown size={14} className={`text-[#6b6360] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
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
                      <div className="px-4 py-3 border-b border-[#f5f1eb]">
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
                      <div className="border-t border-[#f5f1eb]">
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
                  className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl bg-[#b45309] text-white hover:bg-[#92400e] transition-colors cursor-pointer"
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
              className="lg:hidden p-2.5 rounded-xl text-[#6b6360] hover:bg-[#f5f1eb] transition-colors"
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
                    className="flex-1 px-4 py-3 text-[#0a0a0a] text-sm outline-none bg-white"
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
                      className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-[#6b6360] hover:bg-[#f5f1eb] hover:text-[#0a0a0a]"
                    >
                      <Icon size={15} />
                      {label}
                    </Link>
                  ))}
                  <div className="border-t border-[#ede8df] mt-1 pt-1">
                    {user ? (
                      <>
                        <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#a89e96]">
                          <div className="w-5 h-5 rounded bg-[#b45309] flex items-center justify-center text-white text-[9px] font-extrabold">{initials}</div>
                          {displayName}
                        </div>
                        {[
                          { href: '/account', label: 'Dashboard', icon: LayoutDashboard },
                          { href: '/account/orders', label: 'My Orders', icon: Package },
                          { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
                          { href: '/account/profile', label: 'Profile & Addresses', icon: User },
                        ].map(({ href, label, icon: Icon }) => (
                          <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-[#6b6360] hover:bg-[#f5f1eb]">
                            <Icon size={15} /> {label}
                          </Link>
                        ))}
                        <button onClick={() => { handleSignOut(); setMenuOpen(false) }}
                          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-50">
                          <LogOut size={15} /> Sign Out
                        </button>
                      </>
                    ) : (
                      <Link href="/account/login" onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-[#6b6360] hover:bg-[#f5f1eb]">
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
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000. Navbar should be always light `#fafaf8`, logo square and Sign In button should be amber `#b45309`. No green anywhere in the navbar.

- [ ] **Step 3: Commit**

```bash
git add components/store/Navbar.tsx
git commit -m "feat: navbar — always-light amber, remove scroll color change"
```

---

## Task 3: AnnouncementBar + Footer

**Files:**
- Modify: `components/store/AnnouncementBar.tsx`
- Modify: `components/store/Footer.tsx`

- [ ] **Step 1: Update AnnouncementBar — green dot → amber**

In `components/store/AnnouncementBar.tsx`, replace:
```tsx
<span className="w-1 h-1 rounded-full bg-green-500 inline-block" />
```
With:
```tsx
<span className="w-1 h-1 rounded-full bg-[#b45309] inline-block" />
```

- [ ] **Step 2: Update Footer — green → amber throughout**

Replace the entire `components/store/Footer.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { MapPin, Phone, Mail, ArrowUpRight } from 'lucide-react'

function FacebookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

const SOCIAL_LINKS = [
  { icon: FacebookIcon, label: 'Facebook', href: '#' },
  { icon: InstagramIcon, label: 'Instagram', href: '#' },
  { icon: XIcon, label: 'Twitter / X', href: '#' },
  { icon: WhatsAppIcon, label: 'WhatsApp', href: '#' },
]

export default function Footer() {
  return (
    <footer className="bg-[#0a0a0a] text-[#6b6360]">
      {/* Top accent */}
      <div className="h-1 w-full bg-gradient-to-r from-[#b45309] via-[#f59e0b] to-[#b45309]" />

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 pt-16 pb-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
        {/* Brand — 2 cols */}
        <div className="lg:col-span-2">
          <motion.div className="flex items-center gap-2 mb-4" whileHover={{ scale: 1.02 }}>
            <div className="w-9 h-9 rounded-xl bg-[#b45309] flex items-center justify-center font-black text-white text-base">K</div>
            <span className="text-[#fdf6ec] font-extrabold text-2xl">kikuu</span>
          </motion.div>
          <p className="text-[#6b6360] text-sm leading-relaxed mb-5 max-w-xs">
            Ghana&apos;s trusted online marketplace. Shop thousands of products with fast delivery to your doorstep.
          </p>
          <div className="space-y-2.5 text-sm mb-6">
            {[
              { Icon: MapPin, text: 'Accra, Ghana' },
              { Icon: Phone, text: '+233 XX XXX XXXX' },
              { Icon: Mail, text: 'hello@kikuu.com' },
            ].map(({ Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 text-[#6b6360]">
                <Icon size={14} className="text-[#b45309] shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {SOCIAL_LINKS.map(({ icon: Icon, label, href }) => (
              <Link
                key={label}
                href={href}
                title={label}
                className="w-9 h-9 rounded-xl border border-[#1f1f1f] bg-[#141414] flex items-center justify-center text-[#6b6360] hover:text-white hover:bg-[#b45309] hover:border-[#b45309] transition-all duration-200"
              >
                <Icon size={15} />
              </Link>
            ))}
          </div>
        </div>

        {/* Shop */}
        <div>
          <h4 className="text-[#fdf6ec] font-semibold text-sm mb-5 uppercase tracking-wider">Shop</h4>
          <ul className="space-y-3 text-sm">
            {[
              { label: 'All Products', href: '/products' },
              { label: 'Electronics', href: '/products?category=electronics' },
              { label: 'Fashion', href: '/products?category=fashion' },
              { label: 'Phones & Tablets', href: '/products?category=phones-tablets' },
              { label: 'Home & Living', href: '/products?category=home-living' },
              { label: 'Flash Deals', href: '/products?sort=discount' },
            ].map(({ label, href }) => (
              <li key={label}>
                <Link href={href} className="hover:text-[#f59e0b] hover:translate-x-1 transition-all duration-200 inline-flex items-center gap-1 group">
                  {label}
                  <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Help */}
        <div>
          <h4 className="text-[#fdf6ec] font-semibold text-sm mb-5 uppercase tracking-wider">Help</h4>
          <ul className="space-y-3 text-sm">
            {[
              { label: 'Track Your Order', href: '/track' },
              { label: 'Contact Us', href: '/contact' },
              { label: 'Returns Policy', href: '/returns' },
              { label: 'FAQ', href: '/faq' },
              { label: 'Shipping Info', href: '/shipping' },
              { label: 'Seller Guide', href: '/sell' },
            ].map(({ label, href }) => (
              <li key={label}>
                <Link href={href} className="hover:text-[#f59e0b] hover:translate-x-1 transition-all duration-200 inline-flex items-center gap-1 group">
                  {label}
                  <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* We Accept */}
        <div>
          <h4 className="text-[#fdf6ec] font-semibold text-sm mb-5 uppercase tracking-wider">We Accept</h4>
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { label: 'MTN MoMo', color: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' },
              { label: 'Vodafone', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
              { label: 'AirtelTigo', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
              { label: 'Visa/MC', color: 'bg-[#b45309]/10 text-[#f59e0b] border-[#b45309]/20' },
              { label: 'Bank', color: 'bg-[#b45309]/10 text-[#f59e0b] border-[#b45309]/20' },
            ].map(({ label, color }) => (
              <span key={label} className={`border ${color} text-[11px] font-semibold px-2.5 py-1 rounded-lg`}>
                {label}
              </span>
            ))}
          </div>
          <div>
            <p className="text-xs text-[#6b6360] mb-2 uppercase tracking-wider">Powered by</p>
            <div className="flex items-center gap-2">
              <span className="bg-[#141414] border border-[#1f1f1f] text-[#6b6360] text-xs font-semibold px-3 py-1.5 rounded-lg">Paystack</span>
              <span className="bg-[#141414] border border-[#1f1f1f] text-[#6b6360] text-xs font-semibold px-3 py-1.5 rounded-lg">Supabase</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6b6360]">
          <p>
            &copy; {new Date().getFullYear()} Kikuu Technologies Ltd.{' '}
            <span className="text-[#3a3a3a]">Made with love in Ghana 🇬🇭</span>
          </p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-[#a89e96] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#a89e96] transition-colors">Terms of Service</Link>
            <Link href="/cookies" className="hover:text-[#a89e96] transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Verify in browser**

Scroll to the bottom of http://localhost:3000. Footer top accent bar should be amber gradient. Logo square should be amber. Contact icons should be amber. Social icons hover to amber. No green remaining in footer.

- [ ] **Step 4: Commit**

```bash
git add components/store/AnnouncementBar.tsx components/store/Footer.tsx
git commit -m "feat: announcement bar and footer — amber accent, remove green"
```

---

## Task 4: HeroBanner Rewrite

**Files:**
- Modify: `components/store/HeroBanner.tsx`

- [ ] **Step 1: Replace HeroBanner**

Replace the entire `components/store/HeroBanner.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, ShoppingBag, Truck, Shield, Star } from 'lucide-react'
import { useRef, useEffect, useState } from 'react'

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    const duration = 1500
    const steps = 60
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [inView, target])

  return <span ref={ref} className="tabular-nums">{count.toLocaleString()}{suffix}</span>
}

const STATS = [
  { label: 'Happy Customers', value: 12000, suffix: '+' },
  { label: 'Products', value: 5000, suffix: '+' },
  { label: 'Cities Covered', value: 16, suffix: '' },
  { label: 'Orders Delivered', value: 50000, suffix: '+' },
]

export default function HeroBanner() {
  return (
    <section className="relative overflow-hidden">
      {/* Amber gradient hero */}
      <div className="bg-gradient-to-br from-[#fdf3e3] via-[#faecd8] to-[#f5d5a0]">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-flex items-center gap-2 bg-[#b45309]/10 text-[#b45309] text-xs font-bold px-4 py-2 rounded-full mb-6 border border-[#b45309]/20">
              <span className="w-1.5 h-1.5 bg-[#b45309] rounded-full animate-pulse" />
              Ghana&apos;s #1 Online Store
              <span className="flex items-center gap-0.5 text-[#b45309]">
                <Star size={11} className="fill-[#b45309]" />
                <span className="text-xs">4.9</span>
              </span>
            </span>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-[#0a0a0a] leading-[1.02] mb-6 tracking-tight">
              Shop<br />
              <span className="text-[#b45309]">Smarter.</span><br />
              <span className="text-[#0a0a0a]">Live Better.</span>
            </h1>

            <p className="text-[#6b6360] text-lg md:text-xl mb-8 max-w-md leading-relaxed">
              Fast delivery to Accra, Kumasi, Takoradi and all 16 regions.
              Pay with MTN MoMo, Vodafone Cash, or Card.
            </p>

            <div className="flex flex-wrap gap-3 mb-10">
              <Link href="/products?sort=discount">
                <motion.span
                  className="inline-flex items-center gap-2 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white font-bold px-8 py-4 rounded-xl text-base transition-colors cursor-pointer shadow-lg"
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Shop Deals
                  <ArrowRight size={18} />
                </motion.span>
              </Link>
              <Link href="/products">
                <motion.span
                  className="inline-flex items-center gap-2 bg-transparent border-2 border-[#b45309] text-[#b45309] hover:bg-[#b45309] hover:text-white font-semibold px-6 py-4 rounded-xl text-base transition-all cursor-pointer"
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Browse All
                </motion.span>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-5">
              {[
                { icon: Truck, label: 'Free delivery over GHS 200' },
                { icon: Shield, label: 'Secure & encrypted payments' },
                { icon: ShoppingBag, label: '7-day easy returns' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-[#6b6360] text-sm">
                  <div className="w-7 h-7 rounded-lg bg-[#b45309]/10 flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-[#b45309]" />
                  </div>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: floating product card */}
          <div className="hidden lg:flex items-center justify-center">
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Main card */}
              <motion.div
                className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.14)] p-5 w-64 border border-[#ede8df]"
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="w-full h-36 bg-gradient-to-br from-[#fdf6ec] to-[#faecd8] rounded-2xl mb-4 flex items-center justify-center text-6xl">
                  📱
                </div>
                <p className="text-[#a89e96] text-xs mb-1">Electronics</p>
                <p className="text-[#0a0a0a] font-bold text-sm mb-1">Samsung Galaxy S25</p>
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={10} className="fill-[#b45309] text-[#b45309]" />
                  ))}
                  <span className="text-[#a89e96] text-xs ml-1">(128)</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[#b45309] font-extrabold text-lg">GHS 4,200</p>
                  <span className="bg-[#b45309] text-white text-xs font-bold px-3 py-1.5 rounded-lg">Add</span>
                </div>
              </motion.div>

              {/* Delivery notification */}
              <motion.div
                className="absolute -top-4 -right-4 bg-white rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3 border border-[#ede8df]"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              >
                <div className="w-8 h-8 bg-[#fdf6ec] rounded-xl flex items-center justify-center">
                  <Truck size={16} className="text-[#b45309]" />
                </div>
                <div>
                  <p className="text-[#0a0a0a] text-xs font-semibold">Order delivered!</p>
                  <p className="text-[#a89e96] text-[10px]">Accra, East Legon</p>
                </div>
                <span className="w-2 h-2 bg-[#b45309] rounded-full animate-pulse ml-1" />
              </motion.div>

              {/* Hot deal badge */}
              <motion.div
                className="absolute -bottom-4 -left-4 bg-[#0a0a0a] rounded-2xl px-4 py-3 shadow-xl border border-[#1a1a1a]"
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              >
                <p className="text-[#a89e96] text-[10px] uppercase tracking-wider">Happy Customers</p>
                <p className="text-white font-bold text-lg">12,000+</p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="bg-white border-b border-[#ede8df]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {STATS.map(({ label, value, suffix }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-extrabold text-[#b45309]">
                  <AnimatedCounter target={value} suffix={suffix} />
                </p>
                <p className="text-[#a89e96] text-xs mt-0.5 font-medium">{label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Wave transition */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ bottom: '64px' }}>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000. The hero should show an amber gradient background (`#fdf3e3` → `#faecd8` → `#f5d5a0`), text on left with amber headline, floating product card on right. Stats strip below in white. No green, no blobs, no glassmorphism.

- [ ] **Step 3: Commit**

```bash
git add components/store/HeroBanner.tsx
git commit -m "feat: hero banner — amber gradient, clean split layout"
```

---

## Task 5: ProductCard Rewrite

**Files:**
- Modify: `components/store/ProductCard.tsx`

- [ ] **Step 1: Replace ProductCard**

Replace the entire `components/store/ProductCard.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { formatGHS } from '@/lib/utils'
import type { Product } from '@/lib/supabase/types'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Clock } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { useWishlist } from '@/lib/wishlist'
import { useState, useEffect } from 'react'

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart()
  const { toggle, has } = useWishlist()
  const [added, setAdded] = useState(false)
  const [wishlisted, setWishlisted] = useState(false)
  const [cartError, setCartError] = useState('')

  useEffect(() => {
    useWishlist.persist.rehydrate()
    setWishlisted(has(product.id))
  }, [product.id, has])

  const isPreorder = product.status === 'pre_order'
  const outOfStock = product.stock_qty === 0 && !isPreorder
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price
  const discountPct = hasDiscount
    ? Math.round(((product.compare_at_price! - product.price) / product.compare_at_price!) * 100)
    : 0

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    if (outOfStock) return
    const result = addItem(product)
    if (result?.error) {
      setCartError(result.error)
      setTimeout(() => setCartError(''), 4000)
      return
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  function handleWishlist(e: React.MouseEvent) {
    e.preventDefault()
    toggle(product.id)
    setWishlisted((w) => !w)
  }

  return (
    <div className="group relative">
      <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
        <Link
          href={`/products/${product.slug}`}
          className="block bg-white rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.13)] transition-shadow duration-300"
        >
          {/* Image area */}
          <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[#fdf6ec] to-[#faecd8]">
            {product.images[0] ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">📦</div>
            )}

            {/* Top-left badges */}
            <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
              {isPreorder && (
                <span className="inline-flex items-center gap-1 bg-[#b45309] text-white text-[10px] font-bold tracking-wide px-2 py-1 rounded-lg shadow-sm">
                  <Clock size={9} />
                  Pre-order
                </span>
              )}
              {!isPreorder && hasDiscount && (
                <span className="bg-[#b45309] text-white text-[10px] font-extrabold tracking-wide px-2 py-1 rounded-lg shadow-sm tabular-nums">
                  -{discountPct}%
                </span>
              )}
            </div>

            {/* Wishlist */}
            <button
              onClick={handleWishlist}
              className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 z-10 ${
                wishlisted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart size={14} className={wishlisted ? 'fill-[#b45309] text-[#b45309]' : 'text-[#a89e96]'} />
            </button>

            {/* Out of stock overlay */}
            {outOfStock && (
              <div className="absolute inset-0 bg-white/75 backdrop-blur-[1.5px] flex items-center justify-center">
                <span className="text-[11px] font-semibold text-[#6b6360] bg-white px-3 py-1.5 rounded-full border border-[#ede8df] shadow-sm tracking-wide">
                  Out of Stock
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="px-3.5 pt-3 pb-2">
            <p className="text-[13px] font-medium text-[#0a0a0a] line-clamp-2 leading-[1.45] mb-2">
              {product.name}
            </p>
            <div className="flex items-baseline gap-2 mb-2.5">
              <span className="font-extrabold text-[#b45309] text-sm tracking-tight">
                {formatGHS(product.price)}
              </span>
              {hasDiscount && (
                <span className="text-xs text-[#a89e96] line-through font-normal">
                  {formatGHS(product.compare_at_price!)}
                </span>
              )}
            </div>

            {product.stock_qty > 0 && product.stock_qty <= 5 && !isPreorder && (
              <p className="text-[10px] text-[#b45309] font-semibold mb-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#b45309] rounded-full animate-pulse inline-block" />
                Only {product.stock_qty} left
              </p>
            )}

            {isPreorder && product.preorder_ship_date && (
              <p className="text-[10px] text-[#b45309] font-medium mb-2 tracking-wide">
                Ships {new Date(product.preorder_ship_date).toLocaleDateString('en-GH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Full-width CTA */}
          <div className="px-3.5 pb-3.5">
            <button
              onClick={handleAdd}
              disabled={outOfStock}
              className={`w-full py-2.5 rounded-lg text-[11px] font-bold tracking-wide transition-colors ${
                added
                  ? 'bg-[#92400e] text-white'
                  : isPreorder
                  ? 'bg-[#b45309] hover:bg-[#92400e] text-white'
                  : outOfStock
                  ? 'bg-[#f5f1eb] text-[#a89e96] cursor-not-allowed'
                  : 'bg-[#b45309] hover:bg-[#92400e] text-white'
              }`}
            >
              {added ? '✓ Added to Cart!' : isPreorder ? 'Pre-order Now' : outOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        </Link>
      </motion.div>

      {/* Cart conflict error */}
      <AnimatePresence>
        {cartError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 -bottom-1 translate-y-full z-20 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-[11px] text-red-700 leading-snug shadow-lg"
          >
            {cartError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000 and scroll to Featured Products. Cards should have white background with soft shadow, amber gradient image area, amber price, full-width amber "Add to Cart" button. Card lifts on hover.

- [ ] **Step 3: Commit**

```bash
git add components/store/ProductCard.tsx
git commit -m "feat: product card — floating shadow, amber CTA, amber price"
```

---

## Task 6: CategoryGrid

**Files:**
- Modify: `components/store/CategoryGrid.tsx`

- [ ] **Step 1: Replace CategoryGrid**

Replace the entire `components/store/CategoryGrid.tsx`:

```tsx
'use client'

import Link from 'next/link'
import type { Category } from '@/lib/supabase/types'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const CATEGORY_ICONS: Record<string, string> = {
  'electronics': '💻',
  'fashion': '👗',
  'home-living': '🏠',
  'health-beauty': '💄',
  'food-groceries': '🛒',
  'sports-outdoors': '⚽',
  'baby-kids': '🧸',
  'phones-tablets': '📱',
}

export default function CategoryGrid({ categories }: { categories: Category[] }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <div ref={ref} className="grid grid-cols-4 md:grid-cols-8 gap-3">
      {categories.map((cat, i) => (
        <motion.div
          key={cat.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.4, delay: i * 0.05, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
            <Link
              href={`/products?category=${cat.slug}`}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white border border-[#ede8df] hover:border-[#b45309]/30 hover:shadow-[0_4px_16px_rgba(180,83,9,0.10)] transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#fdf6ec] to-[#faecd8] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">{CATEGORY_ICONS[cat.slug] ?? '🏷️'}</span>
              </div>
              <span className="text-xs font-semibold text-[#6b6360] text-center group-hover:text-[#b45309] transition-colors leading-tight">
                {cat.name}
              </span>
            </Link>
          </motion.div>
        </motion.div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Categories section should show white cards with amber-tinted icon backgrounds. On hover, border glows amber and card lifts. Text turns amber. No per-category color variation.

- [ ] **Step 3: Commit**

```bash
git add components/store/CategoryGrid.tsx
git commit -m "feat: category grid — unified amber icon areas, white cards"
```

---

## Task 7: Homepage Sections

**Files:**
- Modify: `app/(store)/page.tsx`

- [ ] **Step 1: Replace homepage**

Replace the entire `app/(store)/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import ProductCard from '@/components/store/ProductCard'
import CategoryGrid from '@/components/store/CategoryGrid'
import HeroBanner from '@/components/store/HeroBanner'
import AnimateIn from '@/components/ui/AnimateIn'
import { StaggerContainer, StaggerItem } from '@/components/ui/StaggerChildren'
import Link from 'next/link'
import { ArrowRight, Truck, ShieldCheck, RotateCcw, Headphones, Zap } from 'lucide-react'
import NewsletterForm from '@/components/store/NewsletterForm'

export default async function HomePage() {
  const supabase = await createClient()

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from('products')
      .select('*')
      .eq('status', 'active')
      .eq('featured', true)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('categories')
      .select('*')
      .is('parent_id', null)
      .order('sort_order'),
  ])

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      <HeroBanner />

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <AnimateIn direction="up">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[#b45309] font-bold text-xs mb-1 uppercase tracking-widest">Browse</p>
              <h2 className="text-3xl font-extrabold text-[#0a0a0a] tracking-tight">Shop by Category</h2>
            </div>
            <Link href="/products" className="hidden sm:flex items-center gap-1.5 text-[#b45309] hover:text-[#92400e] font-semibold text-sm transition-all hover:gap-2.5 group">
              View all <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </AnimateIn>
        <CategoryGrid categories={categories ?? []} />
      </section>

      {/* Why Kikuu */}
      <AnimateIn direction="up">
        <section className="bg-white border-y border-[#ede8df]">
          <div className="max-w-7xl mx-auto px-4 py-16">
            <div className="text-center mb-12">
              <p className="text-[#b45309] font-bold text-xs mb-2 uppercase tracking-widest">Why Kikuu</p>
              <h2 className="text-3xl font-extrabold text-[#0a0a0a] tracking-tight">Shopping made simple</h2>
              <p className="text-[#6b6360] mt-2 max-w-md mx-auto text-sm">
                Trusted by thousands of Ghanaians for fast, safe, and affordable online shopping.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Truck, title: 'Fast Delivery', desc: 'Same-day delivery in Accra. Next-day across Ghana.' },
                { icon: ShieldCheck, title: 'Secure Payments', desc: 'MTN MoMo, Vodafone Cash, Visa, and more. 100% safe.' },
                { icon: RotateCcw, title: 'Easy Returns', desc: '7-day hassle-free returns on all eligible items.' },
                { icon: Headphones, title: '24/7 Support', desc: 'Our team is always ready to help via WhatsApp or phone.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-[#ede8df] bg-white p-5 text-center hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#fdf6ec] flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Icon size={22} className="text-[#b45309]" />
                  </div>
                  <h3 className="font-bold text-[#0a0a0a] text-sm mb-1.5">{title}</h3>
                  <p className="text-[#6b6360] text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </AnimateIn>

      {/* Promo Banner */}
      <AnimateIn direction="up" className="max-w-7xl mx-auto px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#fdf3e3] via-[#faecd8] to-[#f5d5a0] p-8 md:p-12 border border-[#e8d5b0]">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-[#b45309]/10 text-[#b45309] text-xs font-bold px-3 py-1.5 rounded-full mb-4 border border-[#b45309]/20">
              <Zap size={12} className="fill-current" />
              Limited Time Offer
            </div>
            <h3 className="text-3xl md:text-4xl font-extrabold text-[#0a0a0a] mb-4 tracking-tight">
              Free Delivery in Accra
            </h3>
            <p className="text-[#6b6360] mb-6 max-w-sm text-sm md:text-base">
              On all orders over GHS 200. Use code{' '}
              <span className="font-bold bg-white/70 px-2 py-0.5 rounded-lg border border-[#e8d5b0] text-[#b45309]">ACCRA200</span>
            </p>
            <Link href="/products" className="inline-flex items-center gap-2 bg-[#0a0a0a] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#1a1a1a] transition-colors shadow-lg">
              Shop Now <ArrowRight size={16} />
            </Link>
          </div>
          <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-[#b45309]/5" />
          <div className="absolute -right-20 bottom-0 w-72 h-72 rounded-full bg-[#b45309]/5" />
          <div className="absolute right-40 top-6 w-28 h-28 rounded-full bg-white/30" />
        </div>
      </AnimateIn>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 pb-20">
        <AnimateIn direction="up">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[#b45309] font-bold text-xs mb-1 uppercase tracking-widest">Handpicked</p>
              <h2 className="text-3xl font-extrabold text-[#0a0a0a] tracking-tight">Featured Products</h2>
            </div>
            <Link href="/products" className="hidden sm:flex items-center gap-1.5 text-[#b45309] hover:text-[#92400e] font-semibold text-sm transition-all hover:gap-2.5 group">
              View all <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </AnimateIn>

        {products && products.length > 0 ? (
          <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <StaggerItem key={(product as any).id}>
                <ProductCard product={product as any} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : (
          <AnimateIn direction="up">
            <div className="text-center py-24 text-[#a89e96]">
              <div className="text-6xl mb-4">🛍️</div>
              <p className="text-lg font-medium">No products yet</p>
              <p className="text-sm mt-1">Check back soon!</p>
            </div>
          </AnimateIn>
        )}
      </section>

      {/* Newsletter CTA */}
      <AnimateIn direction="up" className="max-w-7xl mx-auto px-4 pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-[#0a0a0a] text-white p-8 md:p-12 text-center">
          <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-[#b45309]/10" />
          <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-[#b45309]/5" />
          <div className="relative z-10 max-w-xl mx-auto">
            <p className="text-[#b45309] text-xs font-bold uppercase tracking-widest mb-3">Stay in the loop</p>
            <h3 className="text-2xl md:text-3xl font-extrabold mb-3 text-white">
              Get exclusive deals first!
            </h3>
            <p className="text-[#6b6360] text-sm mb-7 max-w-sm mx-auto">
              Subscribe and be the first to hear about flash sales, new arrivals, and special offers.
            </p>
            <NewsletterForm />
            <p className="text-[#3a3a3a] text-[11px] mt-3">No spam. Unsubscribe anytime.</p>
          </div>
        </div>
      </AnimateIn>

      {/* Payment methods strip */}
      <AnimateIn direction="up" className="border-t border-[#ede8df] bg-white">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <p className="text-center text-[#a89e96] text-xs font-bold mb-5 uppercase tracking-widest">
            Secure payment with
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { label: 'MTN MoMo', color: 'bg-yellow-400 text-yellow-900' },
              { label: 'Vodafone Cash', color: 'bg-red-500 text-white' },
              { label: 'AirtelTigo', color: 'bg-blue-600 text-white' },
              { label: 'Visa / Mastercard', color: 'bg-[#0a0a0a] text-white' },
              { label: 'Bank Transfer', color: 'bg-[#b45309] text-white' },
            ].map(({ label, color }) => (
              <span key={label} className={`${color} text-xs font-bold px-4 py-2 rounded-xl shadow-sm hover:scale-105 transition-transform cursor-default`}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </AnimateIn>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Full homepage check:
- Why Kikuu cards: white with amber icons
- Promo Banner: amber gradient, dark CTA button
- Newsletter: dark background, amber accent text
- Payment strip: white background, Bank Transfer badge is amber

- [ ] **Step 3: Commit**

```bash
git add app/\(store\)/page.tsx
git commit -m "feat: homepage sections — amber throughout, remove green"
```

---

## Task 8: Cart Page + CartItem

**Files:**
- Modify: `app/(store)/cart/page.tsx`
- Modify: `components/store/CartItem.tsx`

- [ ] **Step 1: Update CartItem — green price → amber**

In `components/store/CartItem.tsx`, replace:
```tsx
<p className="text-green-700 font-semibold text-sm mb-3">{formatGHS(item.price)}</p>
```
With:
```tsx
<p className="text-[#b45309] font-semibold text-sm mb-3">{formatGHS(item.price)}</p>
```

- [ ] **Step 2: Update cart page — green → amber**

In `app/(store)/cart/page.tsx`, make these replacements:

Replace the empty cart icon container:
```tsx
<div className="w-20 h-20 bg-[#fdf6ec] rounded-3xl flex items-center justify-center mx-auto mb-6">
  <ShoppingBag size={32} className="text-[#b45309]" />
</div>
```

Replace the "Start Shopping" button:
```tsx
<Link
  href="/products"
  className="inline-flex items-center gap-2 bg-[#b45309] hover:bg-[#92400e] text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors shadow-sm"
>
  Start Shopping
  <ArrowRight size={15} />
</Link>
```

Replace `text-green-600` "Add more" link:
```tsx
<Link href="/products" className="text-sm text-[#b45309] hover:text-[#92400e] font-medium transition-colors">
  + Add more
</Link>
```

Replace the "Proceed to Checkout" button:
```tsx
<Link
  href="/checkout"
  className="shine-on-hover flex items-center justify-center gap-2 w-full bg-[#b45309] hover:bg-[#92400e] text-white py-3.5 rounded-xl font-semibold text-sm transition-colors shadow-sm"
>
  Proceed to Checkout
  <ArrowRight size={15} />
</Link>
```

- [ ] **Step 3: Verify in browser**

Navigate to http://localhost:3000/cart (add a product first if empty). Item prices should be amber. "Proceed to Checkout" button should be amber. Empty cart icon container should be amber-tinted.

- [ ] **Step 4: Commit**

```bash
git add app/\(store\)/cart/page.tsx components/store/CartItem.tsx
git commit -m "feat: cart page — amber accent, remove green"
```

---

## Task 9: Account Dashboard

**Files:**
- Modify: `app/(store)/account/(dashboard)/page.tsx`

- [ ] **Step 1: Update account dashboard — green → amber**

In `app/(store)/account/(dashboard)/page.tsx`, make these replacements:

Replace the welcome banner:
```tsx
<div className="bg-gradient-to-r from-[#b45309] to-[#d97706] rounded-2xl p-6 text-white">
  <p className="text-[#fdf6ec]/80 text-sm mb-1">Welcome back 👋</p>
  <h1 className="text-2xl font-extrabold">{firstName}</h1>
  <p className="text-[#fdf6ec]/70 text-sm mt-1">Manage your orders, wishlist and account details below.</p>
</div>
```

Replace the stats array — change the `ShoppingBag` stat color from `text-green-600 bg-green-50` to `text-[#b45309] bg-[#fdf6ec]`:
```tsx
{ icon: ShoppingBag, label: 'Total Spent', value: formatGHS(totalSpent), href: '/account/orders', color: 'text-[#b45309] bg-[#fdf6ec]' },
```

Replace "View all" orders link:
```tsx
<Link href="/account/orders" className="text-xs text-[#b45309] font-semibold hover:underline flex items-center gap-1">
  View all <ArrowRight size={12} />
</Link>
```

Replace "Start shopping" link in empty orders state:
```tsx
<Link href="/products" className="mt-3 inline-flex items-center gap-1.5 text-[#b45309] text-xs font-semibold hover:underline">
  Start shopping <ArrowRight size={12} />
</Link>
```

- [ ] **Step 2: Verify in browser**

Log in and navigate to http://localhost:3000/account. Welcome banner should be amber gradient. "Total Spent" stat icon should be amber on amber-tinted bg. Links should be amber.

- [ ] **Step 3: Commit**

```bash
git add app/\(store\)/account/\(dashboard\)/page.tsx
git commit -m "feat: account dashboard — amber welcome banner and accents"
```

---

## Task 10: CheckoutForm Accent Sweep

**Files:**
- Modify: `components/store/CheckoutForm.tsx`

- [ ] **Step 1: Update focus rings and submit button**

In `components/store/CheckoutForm.tsx`, do a global find-and-replace of these Tailwind classes:

| Find | Replace |
|---|---|
| `focus:border-green-500` | `focus:border-[#b45309]` |
| `focus:ring-green-` | `focus:ring-[#b45309]/` |
| `bg-green-600` | `bg-[#b45309]` |
| `hover:bg-green-700` | `hover:bg-[#92400e]` |
| `text-green-600` | `text-[#b45309]` |
| `text-green-700` | `text-[#b45309]` |
| `border-green-` | `border-[#b45309]/` |

The primary submit button (the full-width "Place Order" / "Pay with Paystack" button) should end up as:
```tsx
className="... bg-[#b45309] hover:bg-[#92400e] text-white ..."
```

- [ ] **Step 2: Verify in browser**

Navigate to http://localhost:3000/checkout (add a product to cart first). Input fields should show amber focus rings. The submit button should be amber. No green anywhere on the page.

- [ ] **Step 3: Commit**

```bash
git add components/store/CheckoutForm.tsx
git commit -m "feat: checkout form — amber focus rings and submit button"
```

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| DM Sans font | Task 1 |
| CSS amber tokens | Task 1 |
| Navbar always-light amber | Task 2 |
| AnnouncementBar dark strip, amber dot | Task 3 |
| Footer dark, amber accent | Task 3 |
| HeroBanner amber gradient rewrite | Task 4 |
| ProductCard floating shadow rewrite | Task 5 |
| CategoryGrid amber icon areas | Task 6 |
| Homepage sections updated | Task 7 |
| Cart page amber | Task 8 |
| CartItem amber price | Task 8 |
| Account dashboard amber | Task 9 |
| CheckoutForm amber inputs/button | Task 10 |
| No green in customer-facing UI | All tasks |
| Card hover lift animation | Task 5 & 6 |
| Keep Framer Motion | All tasks |
| Remove blobs/glassmorphism | Task 4 |

### No Placeholders: ✓
All tasks contain complete code. No TBDs.

### Type Consistency: ✓
No new types introduced. All component props match existing interfaces (`Product`, `Category`, `CartItem`).
