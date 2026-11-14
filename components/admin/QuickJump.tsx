'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, CornerDownLeft } from 'lucide-react'
import { NAV_GROUPS } from '@/components/admin/nav'

// Ctrl/Cmd+K palette: jump to any admin page, or look an order up by number,
// name or phone.
export default function QuickJump() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pages = NAV_GROUPS.flatMap((g) => g.items).filter((i) => !q || i.label.toLowerCase().includes(q))
    const list = pages.map((p) => ({ label: p.label, hint: 'Go to page', href: p.href }))
    if (q) list.unshift({ label: `Find orders matching "${query.trim()}"`, hint: 'Search orders', href: `/admin/orders?tab=all&q=${encodeURIComponent(query.trim())}` })
    return list
  }, [query])

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[index]) { e.preventDefault(); go(results[index].href) }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500 hover:border-slate-300 hover:text-slate-700"
      >
        <Search size={14} />
        <span className="hidden sm:inline">Jump to…</span>
        <kbd className="hidden rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 sm:inline">Ctrl K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 px-4 pt-[15vh]" onMouseDown={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Jump to"
            className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-200"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-4">
              <Search size={16} className="text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setIndex(0) }}
                onKeyDown={onInputKey}
                placeholder="Type a page name, or an order number, name or phone"
                aria-label="Jump to"
                className="w-full py-3.5 text-sm placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <ul className="max-h-80 overflow-y-auto p-1.5">
              {results.map((r, i) => (
                <li key={r.href + r.label}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => go(r.href)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${i === index ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700'}`}
                  >
                    <span>{r.label}</span>
                    {i === index ? <CornerDownLeft size={14} className="text-emerald-700" /> : <span className="text-xs text-slate-400">{r.hint}</span>}
                  </button>
                </li>
              ))}
              {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">Nothing matches.</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
