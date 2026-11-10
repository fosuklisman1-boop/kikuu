import { describe, it, expect } from 'vitest'
import { belowMinSurcharge, productTopup, minQtyForMode } from './below-min'

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

describe('purchase modes', () => {
  it('single mode charges the top-up at any quantity', () => {
    expect(belowMinSurcharge({ ...base, mode: 'single', qty: 1 })).toBe(5)
    expect(belowMinSurcharge({ ...base, mode: 'single', qty: 50 })).toBe(5)
  })
  it('bulk mode never charges the top-up', () => {
    expect(belowMinSurcharge({ ...base, mode: 'bulk', qty: 5 })).toBe(0)
  })
  it('bulk lines floor at the minimum, singles at 1', () => {
    expect(minQtyForMode(5, 'bulk')).toBe(5)
    expect(minQtyForMode(5, 'single')).toBe(1)
    expect(minQtyForMode(5, undefined)).toBe(1)
    expect(minQtyForMode(null, 'bulk')).toBe(1)
  })
})
