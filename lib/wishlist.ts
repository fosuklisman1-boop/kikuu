'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WishlistStore {
  ids: string[]
  toggle: (id: string) => void
  has: (id: string) => boolean
  count: number
  clear: () => void
}

export const useWishlist = create<WishlistStore>()(
  persist(
    (set, get) => ({
      ids: [],
      get count() {
        return get().ids.length
      },
      toggle(id) {
        set((s) => ({
          ids: s.ids.includes(id) ? s.ids.filter((i) => i !== id) : [...s.ids, id],
        }))
      },
      has(id) {
        return get().ids.includes(id)
      },
      clear() {
        set({ ids: [] })
      },
    }),
    {
      name: 'telomall-wishlist',
      skipHydration: true,
    }
  )
)
