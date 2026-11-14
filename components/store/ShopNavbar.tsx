'use client'

import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { useEffect } from 'react'
import { useCart } from '@/lib/cart'

// Storefront header for a single shop. Deliberately has no marketplace logo,
// search, category menu, account or "Sell" links — only the shop and its cart.
export default function ShopNavbar({ shopName, home }: { shopName: string; home: string }) {
  const { count } = useCart()

  useEffect(() => {
    useCart.persist.rehydrate()
  }, [])

  return (
    <header className="sticky top-0 z-50 bg-[#fafaf8]/95 backdrop-blur-sm border-b border-[#ede8df]">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-3">
        <Link href={home} className="font-extrabold text-lg tracking-tight text-[#0a0a0a] truncate flex-1">
          {shopName}
        </Link>

        <Link href="/cart" className="relative shrink-0 p-1" aria-label="Cart">
          <ShoppingCart size={22} className="text-[#6b6360]" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#b45309] text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
