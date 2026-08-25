'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Package, LogOut, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/seller/products', label: 'Products', icon: Package },
]

export default function SellerSidebar({ shopName, shopSlug }: { shopName: string; shopSlug: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/account/login')
  }

  return (
    <aside className="hidden lg:flex w-60 bg-gray-950 text-gray-400 flex-col shrink-0">
      <div className="px-5 py-5 border-b border-gray-800 shrink-0">
        <span className="text-white font-extrabold text-xl">
          <span className="text-green-500">Telo</span>Mall
        </span>
        <p className="text-gray-600 text-xs mt-0.5">{shopName}</p>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-green-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
              </div>
            </Link>
          )
        })}
      </nav>

      <div className="p-3 space-y-1 border-t border-gray-800 shrink-0">
        <Link href={`/shop/${shopSlug}`} target="_blank">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-800 hover:text-white transition-colors">
            <ExternalLink size={16} />
            View My Shop
          </div>
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-red-500/10 hover:text-red-400 w-full transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
