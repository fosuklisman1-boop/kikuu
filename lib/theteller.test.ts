import { describe, it, expect } from 'vitest'
import { generateTransactionId } from './theteller'

describe('generateTransactionId', () => {
  it('produces exactly 12 digits', () => {
    const id = generateTransactionId()
    expect(id).toMatch(/^\d{12}$/)
  })

  it('produces different values across calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateTransactionId()))
    expect(ids.size).toBeGreaterThan(1)
  })
})
