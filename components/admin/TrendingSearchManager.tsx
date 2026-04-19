'use client'

import { useState } from 'react'
import { addTrendingSearch, updateTrendingSearch, deleteTrendingSearch } from '@/lib/actions/trending-searches'
import type { TrendingSearch } from '@/lib/supabase/types'
import { X } from 'lucide-react'

export default function TrendingSearchManager({ initialSearches }: { initialSearches: TrendingSearch[] }) {
  const [searches, setSearches] = useState(initialSearches)
  const [newQuery, setNewQuery] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    if (!newQuery.trim()) return
    setAdding(true)
    const result = await addTrendingSearch(newQuery)
    setAdding(false)
    if (result.error) { alert(result.error); return }
    setNewQuery('')
    // Optimistic — page will revalidate
    setSearches((prev) => [
      ...prev,
      { id: Date.now().toString(), query: newQuery.trim(), sort_order: prev.length, active: true, created_at: '' },
    ])
  }

  async function handleToggle(s: TrendingSearch) {
    await updateTrendingSearch(s.id, { active: !s.active })
    setSearches((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)))
  }

  async function handleDelete(id: string) {
    await deleteTrendingSearch(id)
    setSearches((prev) => prev.filter((x) => x.id !== id))
  }

  async function handleSortOrder(id: string, order: number) {
    await updateTrendingSearch(id, { sort_order: order })
    setSearches((prev) => prev.map((x) => (x.id === id ? { ...x, sort_order: order } : x)))
  }

  return (
    <div className="space-y-4">
      {/* Add input */}
      <div className="flex gap-2">
        <input
          value={newQuery}
          onChange={(e) => setNewQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a search term…"
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
        />
        <button onClick={handleAdd} disabled={adding || !newQuery.trim()}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50">
          {adding ? '…' : 'Add'}
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {searches.length === 0 ? (
          <p className="text-center py-12 text-gray-400 text-sm">No trending searches yet.</p>
        ) : (
          searches.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <input
                type="number"
                value={s.sort_order}
                onChange={(e) => handleSortOrder(s.id, Number(e.target.value))}
                className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center"
              />
              <span className={`flex-1 text-sm ${s.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                {s.query}
              </span>
              <button onClick={() => handleToggle(s)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {s.active ? 'Active' : 'Hidden'}
              </button>
              <button onClick={() => handleDelete(s.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                <X size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
