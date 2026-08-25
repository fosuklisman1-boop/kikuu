import { describe, it, expect } from 'vitest'
import { computeShopPrice } from './shop-pricing'

describe('computeShopPrice', () => {
  it('adds a flat markup to the base price', () => {
    expect(computeShopPrice(50, 'flat', 10)).toBe(60)
  })

  it('applies a percentage markup to the base price', () => {
    expect(computeShopPrice(50, 'percentage', 20)).toBe(60)
  })

  it('rounds to 2 decimal places', () => {
    expect(computeShopPrice(19.99, 'percentage', 15)).toBe(22.99)
  })

  it('returns the base price when markup is zero', () => {
    expect(computeShopPrice(50, 'flat', 0)).toBe(50)
    expect(computeShopPrice(50, 'percentage', 0)).toBe(50)
  })
})
