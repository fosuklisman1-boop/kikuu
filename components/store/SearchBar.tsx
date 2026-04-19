'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, TrendingUp } from 'lucide-react'
import type { TrendingSearch } from '@/lib/supabase/types'

type Suggestion = { name: string; slug: string }

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
    setLoading(true)
    fetch(`/api/search/suggestions?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then(({ suggestions }) => setSuggestions(suggestions))
      .finally(() => setLoading(false))
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
            <ul>
              {suggestions.map((s) => (
                <li key={s.slug}>
                  <button
                    onClick={() => handleSuggestion(s.slug)}
                    className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-[#fdf6ec] text-left text-sm text-gray-800"
                  >
                    <Search size={13} className="text-gray-300 shrink-0" />
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
