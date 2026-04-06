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
