'use client'

import { Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SearchBar({ defaultValue = '' }: { defaultValue?: string }) {
  const [query, setQuery] = useState(defaultValue)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    router.push(`/products?${params}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 relative">
      <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products, brands, categories..."
        className="w-full pl-11 pr-28 py-3 bg-white border border-[#e8e5e0] rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all shadow-sm"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery('')}
          className="absolute right-[5.5rem] top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={13} />
        </button>
      )}
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors tracking-wide"
      >
        Search
      </button>
    </form>
  )
}
