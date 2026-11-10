'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@/lib/supabase/types'
import { belowMinSurcharge, productTopup, type PurchaseMode } from '@/lib/below-min'

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
  min_order_qty: number | null
  max_order_qty: number | null
  below_min_topup: number | null
  purchase_mode?: PurchaseMode
  selected_color?: { name: string; hex: string }
  selected_size?: string
}

// Unit price actually charged for this line at its current quantity: the
// base price, plus the category top-up when a pre-order is below its minimum.
export function cartUnitPrice(item: CartItem, basePrice: number = item.price, qty: number = item.quantity): number {
  return basePrice + belowMinSurcharge({
    isPreorder: item.is_preorder,
    minQty: item.min_order_qty,
    topup: item.below_min_topup,
    qty,
    mode: item.purchase_mode,
  })
}

function deriveCart(items: CartItem[]) {
  // qty=0 items are "pending removal" — excluded from totals/counts
  const active = items.filter((i) => i.quantity > 0)
  return {
    total: active.reduce((sum, i) => sum + cartUnitPrice(i) * i.quantity, 0),
    count: active.reduce((sum, i) => sum + i.quantity, 0),
    hasPreorderItems: active.some((i) => i.is_preorder),
  }
}

interface CartStore {
  items: CartItem[]
  total: number
  count: number
  hasPreorderItems: boolean
  shopId: string | null
  shopSlug: string | null
  _hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  addItem: (
    product: Product,
    qty?: number,
    selectedColor?: { name: string; hex: string },
    selectedSize?: string,
    shopContext?: { shopId: string; shopSlug: string },
    purchaseMode?: PurchaseMode,
  ) => { error?: string }
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  applyPreorderRules: (rules: Record<string, { min_order_qty: number | null; max_order_qty: number | null; below_min_topup: number | null }>) => void
  clearCart: () => void
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      total: 0,
      count: 0,
      hasPreorderItems: false,
      shopId: null,
      shopSlug: null,
      _hasHydrated: false,
      setHasHydrated(v) { set({ _hasHydrated: v }) },

      addItem(product, qty = 1, selectedColor, selectedSize, shopContext, purchaseMode) {
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

        // Block mixing items from a different shop (or shop + main site) in one cart
        if (state.items.length > 0) {
          const newShopId = shopContext?.shopId ?? null
          if (state.shopId !== newShopId) {
            return { error: 'Your cart has items from another store. Clear your cart or finish checkout first.' }
          }
        }

        // Composite ID keeps different variants (and single vs bulk) as separate cart lines
        const baseId = (selectedColor || selectedSize)
          ? `${product.id}__${selectedColor?.name ?? ''}__${selectedSize ?? ''}`
          : product.id
        const variantId = purchaseMode ? `${baseId}__${purchaseMode}` : baseId

        // Stock is always the hard ceiling; max_order_qty (pre-order only)
        // can tighten it further, never loosen it.
        const ceiling = product.max_order_qty
          ? Math.min(product.stock_qty, product.max_order_qty)
          : product.stock_qty

        const existing = state.items.find((i) => i.id === variantId)
        let items: CartItem[]
        if (existing) {
          const newQty = Math.min(existing.quantity + qty, ceiling)
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
              quantity: Math.min(qty, ceiling),
              stock_qty: product.stock_qty,
              is_preorder: isPreorder,
              preorder_days: product.preorder_days ?? null,
              preorder_note: product.preorder_note ?? null,
              min_order_qty: product.min_order_qty ?? null,
              max_order_qty: product.max_order_qty ?? null,
              // Shop prices are seller-set, so the category top-up never applies to them
              below_min_topup: shopContext ? null : (productTopup(product) || null),
              purchase_mode: purchaseMode,
              selected_color: selectedColor,
              selected_size: selectedSize,
            },
          ]
        }
        set({
          items,
          shopId: shopContext?.shopId ?? state.shopId,
          shopSlug: shopContext?.shopSlug ?? state.shopSlug,
          ...deriveCart(items),
        })
        return {}
      },

      removeItem(id) {
        const items = get().items.filter((i) => i.id !== id)
        const shopReset = items.length === 0 ? { shopId: null, shopSlug: null } : {}
        set({ items, ...shopReset, ...deriveCart(items) })
      },

      updateQty(id, qty) {
        if (qty < 0) return
        // qty=0 keeps the item in the array (grayed out) until the cart page unmounts
        const items = get().items.map((i) => {
          if (i.id !== id) return i
          const ceiling = i.max_order_qty ? Math.min(i.stock_qty, i.max_order_qty) : i.stock_qty
          return { ...i, quantity: qty === 0 ? 0 : Math.min(qty, ceiling) }
        })
        set({ items, ...deriveCart(items) })
      },

      applyPreorderRules(rules) {
        const { shopId } = get()
        const items = get().items.map((i) => {
          const r = rules[i.product_id]
          if (!r || !i.is_preorder) return i
          return { ...i, min_order_qty: r.min_order_qty, max_order_qty: r.max_order_qty, below_min_topup: shopId ? null : r.below_min_topup }
        })
        set({ items, ...deriveCart(items) })
      },

      clearCart() {
        set({ items: [], shopId: null, shopSlug: null, total: 0, count: 0, hasPreorderItems: false })
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
