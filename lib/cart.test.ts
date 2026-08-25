import { describe, it, expect, beforeEach } from 'vitest'
import { useCart } from './cart'
import type { Product } from './supabase/types'

const baseProduct: Product = {
  id: 'prod-1',
  name: 'Test Product',
  slug: 'test-product',
  description: null,
  category_id: 'cat-1',
  price: 100,
  compare_at_price: null,
  stock_qty: 10,
  images: ['img.jpg'],
  videos: [],
  status: 'active',
  preorder_days: null,
  preorder_note: null,
  featured: false,
  brand_id: null,
  attributes: {},
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('useCart shop scoping', () => {
  beforeEach(() => {
    useCart.getState().clearCart()
  })

  it('starts with no shop context', () => {
    expect(useCart.getState().shopId).toBeNull()
    expect(useCart.getState().shopSlug).toBeNull()
  })

  it('sets shop context when the first item added is from a shop', () => {
    useCart.getState().addItem(
      { ...baseProduct, price: 60 }, 1, undefined, undefined,
      { shopId: 'shop-1', shopSlug: 'my-shop' }
    )
    expect(useCart.getState().shopId).toBe('shop-1')
    expect(useCart.getState().shopSlug).toBe('my-shop')
    expect(useCart.getState().items[0].price).toBe(60)
  })

  it('rejects adding a main-site item when the cart already has shop items', () => {
    useCart.getState().addItem(
      { ...baseProduct, price: 60 }, 1, undefined, undefined,
      { shopId: 'shop-1', shopSlug: 'my-shop' }
    )
    const result = useCart.getState().addItem({ ...baseProduct, id: 'prod-2' })
    expect(result.error).toBeDefined()
    expect(useCart.getState().items).toHaveLength(1)
  })

  it('rejects adding an item from a different shop', () => {
    useCart.getState().addItem(baseProduct, 1, undefined, undefined, { shopId: 'shop-1', shopSlug: 'my-shop' })
    const result = useCart.getState().addItem(
      { ...baseProduct, id: 'prod-2' }, 1, undefined, undefined,
      { shopId: 'shop-2', shopSlug: 'other-shop' }
    )
    expect(result.error).toBeDefined()
  })

  it('resets shop context once the cart is emptied via removeItem', () => {
    useCart.getState().addItem(baseProduct, 1, undefined, undefined, { shopId: 'shop-1', shopSlug: 'my-shop' })
    useCart.getState().removeItem('prod-1')
    expect(useCart.getState().shopId).toBeNull()
    expect(useCart.getState().shopSlug).toBeNull()
  })

  it('allows a main-site item after clearCart resets shop context', () => {
    useCart.getState().addItem(baseProduct, 1, undefined, undefined, { shopId: 'shop-1', shopSlug: 'my-shop' })
    useCart.getState().clearCart()
    const result = useCart.getState().addItem({ ...baseProduct, id: 'prod-2' })
    expect(result.error).toBeUndefined()
    expect(useCart.getState().shopId).toBeNull()
  })
})
