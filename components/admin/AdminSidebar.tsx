'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, ExternalLink, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NAV_GROUPS, NAV_ITEMS } from '@/components/admin/nav'
import QuickJump from '@/components/admin/QuickJump'

function isActive(href: string, pathname: string) {
  return href === '/admin' ? pathname === href : pathname.startsWith(href)
}

function SidebarContent({ toShip, onClose }: { toShip: number; onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <div className="flex shrink-0 items-center justify-between px-5 py-5">
        <div>
          <span className="text-xl font-extrabold text-white">
            <span className="text-emerald-400">Telo</span>Mall
          </span>
          <p className="mt-0.5 text-xs text-emerald-200/50">Admin</p>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-1 text-emerald-100/60 hover:text-white">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Admin">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1.5 text-xs font-medium text-emerald-200/40">{group.title}</p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href, pathname)
                const badge = href === '/admin/orders' && toShip > 0 ? toShip : 0
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${
                      active ? 'bg-emerald-500/15 text-white' : 'text-emerald-50/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon size={16} className={active ? 'text-emerald-400' : ''} />
                    <span className="flex-1">{label}</span>
                    {badge > 0 && (
                      <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-950" aria-label={`${badge} orders to ship`}>
                        {badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-white/10 p-3">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-emerald-50/60 hover:bg-white/5 hover:text-white">
          <ExternalLink size={16} /> View store
        </Link>
        <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-emerald-50/60 hover:bg-red-500/10 hover:text-red-300">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </>
  )
}

export default function AdminSidebar({ toShip = 0 }: { toShip?: number }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const currentPage = NAV_ITEMS.find((n) => isActive(n.href, pathname))

  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col bg-[#10231a] lg:flex">
        <SidebarContent toShip={toShip} />
      </aside>

      {/* Top bar: page name + quick jump (mobile also holds the menu button) */}
      <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:left-60">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden">
          <Menu size={22} />
        </button>
        <span className="text-sm font-medium text-slate-700">{currentPage?.label ?? 'Admin'}</span>
        <div className="ml-auto">
          <QuickJump />
        </div>
      </header>

      {open && (
        <>
          <div onClick={() => setOpen(false)} className="fixed inset-0 z-50 bg-black/50 lg:hidden" />
          <aside className="fixed bottom-0 left-0 top-0 z-50 flex w-72 flex-col bg-[#10231a] lg:hidden">
            <SidebarContent toShip={toShip} onClose={() => setOpen(false)} />
          </aside>
        </>
      )}
    </>
  )
}
