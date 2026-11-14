'use client'

import Link from 'next/link'
import { ShoppingCart, Menu, User as UserIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCart } from '@/lib/cart'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import ProfileSidebar from '@/components/store/ProfileSidebar'

// Storefront header for a single shop. Deliberately has no marketplace logo,
// search, category menu or "Sell" links — nothing here leads off the shop.
export default function ShopNavbar({ shopName, home }: { shopName: string; home: string }) {
  const { count } = useCart()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
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

  const meta = user?.user_metadata as Record<string, string> | null
  const displayName = meta?.full_name || user?.email?.split('@')[0] || ''
  const initials =
    displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?'

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

        {user ? (
          <button onClick={() => setMenuOpen(true)} className="shrink-0 text-[#6b6360] p-1" aria-label="Open menu">
            <Menu size={22} />
          </button>
        ) : (
          <Link href="/account/login" className="shrink-0 text-[#6b6360] p-1" aria-label="Sign in">
            <UserIcon size={22} />
          </Link>
        )}
      </div>

      {user && (
        <ProfileSidebar
          shopMode
          displayName={displayName}
          email={user.email ?? ''}
          initials={initials}
          wishlistCount={0}
          shopHref=""
          shopLabel=""
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </header>
  )
}
