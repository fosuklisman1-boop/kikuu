'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@/lib/supabase/types'

export interface CartItem {
  id: string           // composite key: productId__colorName__sizeName (or just productId if no variants)
  product_id: string   // always the real product UUID — used for DB lookups
  name: string
  price: number
  image: string
  quantity: number
  stock_qty: number
  is_preorder: boolean
  preorder_days: number | null
  preorder_note: string | null
  selected_color?: { name: string; hex: string }
  selected_size?: string
}

function deriveCart(items: CartItem[]) {
  // qty=0 items are "pending removal" — excluded from totals/counts
  const active = items.filter((i) => i.quantity > 0)
  return {
    total: active.reduce((sum, i) => sum + i.price * i.quantity, 0),
    count: active.reduce((sum, i) => sum + i.quantity, 0),
    hasPreorderItems: active.some((i) => i.is_preorder),
  }
}

interface CartStore {
  items: CartItem[]
  total: number
  count: number
  hasPreorderItems: boolean
  _hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  addItem: (
    product: Product,
    qty?: number,
    selectedColor?: { name: string; hex: string },
    selectedSize?: string,
  ) => { error?: string }
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
      _hasHydrated: false,
      setHasHydrated(v) { set({ _hasHydrated: v }) },

      addItem(product, qty = 1, selectedColor, selectedSize) {
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

        // Composite ID keeps different variants as separate cart lines
        const variantId = (selectedColor || selectedSize)
          ? `${product.id}__${selectedColor?.name ?? ''}__${selectedSize ?? ''}`
          : product.id

        const existing = state.items.find((i) => i.id === variantId)
        let items: CartItem[]
        if (existing) {
          const newQty = isPreorder
            ? existing.quantity + qty
            : Math.min(existing.quantity + qty, product.stock_qty)
          items = state.items.map((i) =>
            i.id === variantId ? { ...i, quantity: newQty } : i
          )
        } else {
          items = [
            ...state.items,
            {
              id: variantId,
              product_id: product.id,
              name: product.name,
              price: product.price,
              image: product.images[0] ?? '',
              quantity: isPreorder ? qty : Math.min(qty, product.stock_qty),
              stock_qty: product.stock_qty,
              is_preorder: isPreorder,
              preorder_days: product.preorder_days ?? null,
              preorder_note: product.preorder_note ?? null,
              selected_color: selectedColor,
              selected_size: selectedSize,
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
        if (qty < 0) return
        // qty=0 keeps the item in the array (grayed out) until the cart page unmounts
        const items = get().items.map((i) =>
          i.id === id
            ? { ...i, quantity: qty === 0 ? 0 : Math.min(qty, i.stock_qty) }
            : i
        )
        set({ items, ...deriveCart(items) })
      },

      clearCart() {
        set({ items: [], total: 0, count: 0, hasPreorderItems: false })
      },
    }),
    {
      name: 'telomall-cart',
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
