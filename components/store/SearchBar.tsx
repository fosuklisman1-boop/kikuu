'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, TrendingUp } from 'lucide-react'
import { formatGHS } from '@/lib/utils'
import type { TrendingSearch } from '@/lib/supabase/types'

type Suggestion = {
  id: string
  name: string
  slug: string
  price: number
  compare_at_price: number | null
  images: string[]
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export default function SearchBar({
  trendingSearches,
  placeholder = 'Search products…',
  initialQuery = '',
}: {
  trendingSearches: TrendingSearch[]
  placeholder?: string
  initialQuery?: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debouncedQuery.length < 2) { setSuggestions([]); return }
    let active = true
    setLoading(true)
    fetch(`/api/search/suggestions?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then(({ suggestions }) => { if (active) setSuggestions(suggestions ?? []) })
      .finally(() => { if (active) setLoading(false) })
    // Ignore a slow response if the query changed before it resolved
    return () => { active = false }
  }, [debouncedQuery])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setOpen(false)
    router.push(`/products?q=${encodeURIComponent(query.trim())}`)
  }

  function handleTrending(q: string) {
    setQuery(q)
    setOpen(false)
    router.push(`/products?q=${encodeURIComponent(q)}`)
  }

  function handleSuggestion(slug: string) {
    setOpen(false)
    router.push(`/products/${slug}`)
  }

  const showDropdown = open && (query.length < 2 ? trendingSearches.length > 0 : true)

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            placeholder={placeholder}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#ede8df] bg-white text-sm text-[#0a0a0a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#b45309]/30 focus:border-[#b45309]"
          />
        </div>
      </form>

      {showDropdown && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-xl border border-[#ede8df] shadow-xl z-50 overflow-hidden">
          {query.length < 2 ? (
            <>
              <div className="px-4 pt-3 pb-1 flex items-center gap-1.5 text-[10px] text-gray-400 font-semibold uppercase tracking-widest">
                <TrendingUp size={11} /> Trending
              </div>
              <div className="flex flex-wrap gap-2 px-4 pb-3">
                {trendingSearches.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTrending(t.query)}
                    className="bg-[#fdf6ec] text-[#b45309] text-xs font-medium px-3 py-1.5 rounded-full hover:bg-[#b45309] hover:text-white transition-colors"
                  >
                    {t.query}
                  </button>
                ))}
              </div>
            </>
          ) : loading ? (
            <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">No results for "{query}"</div>
          ) : (
            <>
              <ul className="max-h-80 overflow-y-auto">
                {suggestions.map((s) => {
                  const onSale = s.compare_at_price != null && s.compare_at_price > s.price
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => handleSuggestion(s.slug)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-[#fdf6ec] text-left transition-colors"
                      >
                        <div className="w-11 h-11 rounded-lg bg-[#f5f0e8] shrink-0 overflow-hidden flex items-center justify-center">
                          {s.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.images[0]} alt={s.name} className="w-full h-full object-cover" />
                          ) : (
                            <Search size={15} className="text-gray-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-800 line-clamp-1">{s.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#b45309]">{formatGHS(s.price)}</span>
                            {onSale && (
                              <span className="text-xs text-gray-400 line-through">{formatGHS(s.compare_at_price!)}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 w-full px-4 py-2.5 border-t border-[#ede8df] text-left text-xs font-semibold text-[#b45309] hover:bg-[#fdf6ec] transition-colors"
              >
                <Search size={13} className="shrink-0" />
                See all results for &ldquo;{query.trim()}&rdquo;
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
