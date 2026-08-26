import { describe, it, expect } from 'vitest'
import { computeOrderEarnings } from './wallet-earnings'
import type { OrderItem } from './supabase/types'

function item(overrides: Partial<OrderItem>): OrderItem {
  return {
    product_id: 'p1',
    product_name: 'Test Product',
    product_image: '',
    price: 60,
    base_price: 50,
    quantity: 1,
    is_preorder: false,
    preorder_ship_date: null,
    preorder_note: null,
    ...overrides,
  }
}

describe('computeOrderEarnings', () => {
  it('computes markup times quantity for a single shop item', () => {
    expect(computeOrderEarnings([item({ price: 60, base_price: 50, quantity: 2 })])).toBe(20)
  })

  it('sums earnings across multiple items', () => {
    expect(computeOrderEarnings([
      item({ price: 60, base_price: 50, quantity: 1 }),
      item({ price: 30, base_price: 25, quantity: 3 }),
    ])).toBe(25) // 10 + 15
  })

  it('contributes 0 for items with base_price null (non-shop items)', () => {
    expect(computeOrderEarnings([item({ price: 60, base_price: null, quantity: 1 })])).toBe(0)
  })

  it('returns 0 for an empty order', () => {
    expect(computeOrderEarnings([])).toBe(0)
  })

  it('treats a missing base_price key (not just null) as a non-shop item', () => {
    const legacyItem = {
      product_id: 'p1',
      product_name: 'Legacy Product',
      product_image: '',
      price: 60,
      quantity: 1,
      is_preorder: false,
      preorder_ship_date: null,
      preorder_note: null,
      // no base_price key at all — simulates data written before this field existed
    } as unknown as OrderItem
    expect(computeOrderEarnings([legacyItem])).toBe(0)
  })
})
