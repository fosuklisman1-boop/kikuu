import { describe, it, expect } from 'vitest'
import { ShopSchema } from './shop-schema'

describe('ShopSchema', () => {
  it('accepts a valid name and slug', () => {
    const result = ShopSchema.safeParse({ name: 'Ama Fashions', slug: 'ama-fashions' })
    expect(result.success).toBe(true)
  })

  it('rejects a slug with uppercase letters', () => {
    const result = ShopSchema.safeParse({ name: 'Ama Fashions', slug: 'Ama-Fashions' })
    expect(result.success).toBe(false)
  })

  it('rejects a slug that is too short', () => {
    const result = ShopSchema.safeParse({ name: 'Ama Fashions', slug: 'ab' })
    expect(result.success).toBe(false)
  })

  it('rejects a slug with invalid characters', () => {
    const result = ShopSchema.safeParse({ name: 'Ama Fashions', slug: 'ama_fashions!' })
    expect(result.success).toBe(false)
  })

  it('rejects a reserved slug', () => {
    const result = ShopSchema.safeParse({ name: 'Admin Store', slug: 'admin' })
    expect(result.success).toBe(false)
  })

  it('still accepts a non-reserved, otherwise-valid slug', () => {
    const result = ShopSchema.safeParse({ name: 'Ama Fashions', slug: 'ama-fashions' })
    expect(result.success).toBe(true)
  })
})
