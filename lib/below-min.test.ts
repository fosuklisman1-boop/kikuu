import { describe, it, expect } from 'vitest'
import { belowMinSurcharge, productTopup } from './below-min'

const base = { isPreorder: true, minQty: 5, topup: 5 }

describe('belowMinSurcharge', () => {
  it('charges the top-up below the minimum', () => {
    expect(belowMinSurcharge({ ...base, qty: 1 })).toBe(5)
    expect(belowMinSurcharge({ ...base, qty: 4 })).toBe(5)
  })
  it('charges nothing at or above the minimum', () => {
    expect(belowMinSurcharge({ ...base, qty: 5 })).toBe(0)
    expect(belowMinSurcharge({ ...base, qty: 20 })).toBe(0)
  })
  it('charges nothing for regular products or when unset', () => {
    expect(belowMinSurcharge({ ...base, isPreorder: false, qty: 1 })).toBe(0)
    expect(belowMinSurcharge({ ...base, topup: null, qty: 1 })).toBe(0)
    expect(belowMinSurcharge({ ...base, topup: 0, qty: 1 })).toBe(0)
    expect(belowMinSurcharge({ ...base, minQty: null, qty: 1 })).toBe(0)
  })
})

describe('productTopup', () => {
  it('reads the joined category top-up', () => {
    expect(productTopup({ categories: { below_min_topup: 7.5 } })).toBe(7.5)
    expect(productTopup({ categories: { below_min_topup: '3.00' } })).toBe(3)
  })
  it('defaults to 0', () => {
    expect(productTopup({})).toBe(0)
    expect(productTopup(null)).toBe(0)
    expect(productTopup({ categories: null })).toBe(0)
  })
})
