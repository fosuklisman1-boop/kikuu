'use client'

import Link from 'next/link'
import { Home, ShoppingCart, PackageSearch } from 'lucide-react'
import { usePathname } from 'next/navigation'

// Mobile tab bar for a single shop: shop home, cart and guest order tracking.
// No catalog, pre-order, wishlist or account tabs (marketplace-wide).
export default function ShopBottomTabBar({ home }: { home: string }) {
  const pathname = usePathname()
  const tabs = [
    { label: 'Shop', icon: Home, href: home, active: pathname === home || (home !== '/' && pathname.startsWith(`${home}/`)) },
    { label: 'Cart', icon: ShoppingCart, href: '/cart', active: pathname.startsWith('/cart') },
    { label: 'Track Order', icon: PackageSearch, href: '/track', active: pathname.startsWith('/track') || pathname.startsWith('/orders') },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-[#ede8df]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-16">
        {tabs.map(({ label, icon: Icon, href, active }) => (
          <Link key={label} href={href} className="flex-1 flex items-center justify-center">
            <span className={`flex flex-col items-center gap-1 ${active ? 'text-[#b45309]' : 'text-[#a89e96]'}`}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-semibold">{label}</span>
            </span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
