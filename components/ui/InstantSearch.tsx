'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

// Instant, in-page filtering for server-rendered lists. Wrap a list in
// <SearchScope> and wrap each row/card in <SearchItem text="...">; rows whose
// text doesn't contain every typed word are hidden. Only rows already loaded
// on the page are searched.

const QueryContext = createContext('')
const CategoryContext = createContext<string | null>(null)

export interface SearchCategory { id: string; name: string }

const normalize = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')

export function SearchScope({
  placeholder = 'Search…',
  children,
  className = '',
  barClassName = 'mb-4',
  categories,
}: {
  // Optional: when given, a row of category chips filters SearchItems that
  // carry a matching categoryId.
  categories?: SearchCategory[]
  placeholder?: string
  children: React.ReactNode
  className?: string
  barClassName?: string
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [noMatches, setNoMatches] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const total = el.querySelectorAll('[data-search-item]').length
    const visible = el.querySelectorAll('[data-search-item]:not([data-search-hidden])').length
    setNoMatches((query.trim() !== '' || category !== null) && total > 0 && visible === 0)
  }, [query, category])

  return (
    <QueryContext.Provider value={query}>
     <CategoryContext.Provider value={category}>
      <div className={className}>
        <div className={barClassName}>
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full border border-gray-200 bg-white rounded-xl pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-gray-400 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              <X size={14} />
            </button>
          )}
        </div>
        </div>
        {categories && categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-1 -mt-1">
            {[{ id: null, name: 'All' }, ...categories].map((c) => (
              <button
                key={c.id ?? 'all'}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  category === c.id ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        <div ref={listRef}>{children}</div>
        {noMatches && (
          <p className="text-center text-sm text-gray-400 py-10">
            {query.trim() ? <>No matches for &ldquo;{query.trim()}&rdquo;</> : 'No products in this category.'}
          </p>
        )}
      </div>
     </CategoryContext.Provider>
    </QueryContext.Provider>
  )
}

export function SearchItem({
  text,
  categoryId,
  as: Tag = 'div',
  children,
  ...rest
}: {
  text: string
  categoryId?: string | null
  as?: 'div' | 'tr' | 'li' | 'section' | 'article'
  children: React.ReactNode
} & React.HTMLAttributes<HTMLElement>) {
  const query = useContext(QueryContext)
  const category = useContext(CategoryContext)
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const haystack = normalize(text)
  const match = words.every((w) => haystack.includes(w)) && (category === null || categoryId === category)
  const Element = Tag as React.ElementType
  return (
    <Element
      {...rest}
      data-search-item=""
      data-search-hidden={match ? undefined : ''}
      style={match ? rest.style : { ...rest.style, display: 'none' }}
    >
      {children}
    </Element>
  )
}
