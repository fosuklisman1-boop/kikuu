'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@/lib/supabase/types'

export interface CartItem {
  id: string
  name: string
  price: number
  image: string
  quantity: number
  stock_qty: number
  is_preorder: boolean
  preorder_ship_date: string | null
}

function deriveCart(items: CartItem[]) {
  const preorderDates = items
    .filter((i) => i.is_preorder && i.preorder_ship_date)
    .map((i) => i.preorder_ship_date!)
    .sort()
  return {
    total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    count: items.reduce((sum, i) => sum + i.quantity, 0),
    hasPreorderItems: items.some((i) => i.is_preorder),
    latestPreorderDate: preorderDates.at(-1) ?? null,
  }
}

interface CartStore {
  items: CartItem[]
  total: number
  count: number
  hasPreorderItems: boolean
  latestPreorderDate: string | null
  _hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  addItem: (product: Product, qty?: number) => { error?: string }
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  clearCart: () => void
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      total: 0,
      count: 0,
      hasPreorderItems: false,
      latestPreorderDate: null,
      _hasHydrated: false,
      setHasHydrated(v) { set({ _hasHydrated: v }) },

      addItem(product, qty = 1) {
        const state = get()
        const isPreorder = product.status === 'pre_order'

        // Block mixing pre-order and regular items
        if (state.items.length > 0) {
          const cartHasPreorder = state.hasPreorderItems
          if (isPreorder && !cartHasPreorder) {
            return { error: 'Pre-order items must be ordered separately. Please clear your cart first or complete your current order.' }
          }
          if (!isPreorder && cartHasPreorder) {
            return { error: 'Regular items cannot be mixed with pre-order items. Please clear your cart first or complete your pre-order.' }
          }
        }

        const existing = state.items.find((i) => i.id === product.id)
        let items: CartItem[]
        if (existing) {
          const newQty = isPreorder
            ? existing.quantity + qty
            : Math.min(existing.quantity + qty, product.stock_qty)
          items = state.items.map((i) =>
            i.id === product.id ? { ...i, quantity: newQty } : i
          )
        } else {
          items = [
            ...state.items,
            {
              id: product.id,
              name: product.name,
              price: product.price,
              image: product.images[0] ?? '',
              quantity: isPreorder ? qty : Math.min(qty, product.stock_qty),
              stock_qty: product.stock_qty,
              is_preorder: isPreorder,
              preorder_ship_date: product.preorder_ship_date ?? null,
            },
          ]
        }
        set({ items, ...deriveCart(items) })
        return {}
      },

      removeItem(id) {
        const items = get().items.filter((i) => i.id !== id)
        set({ items, ...deriveCart(items) })
      },

      updateQty(id, qty) {
        if (qty < 1) {
          get().removeItem(id)
          return
        }
        const items = get().items.map((i) =>
          i.id === id ? { ...i, quantity: Math.min(qty, i.stock_qty) } : i
        )
        set({ items, ...deriveCart(items) })
      },

      clearCart() {
        set({ items: [], total: 0, count: 0, hasPreorderItems: false, latestPreorderDate: null })
      },
    }),
    {
      name: 'kikuu-cart',
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
