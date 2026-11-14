import { describe, it, expect } from 'vitest'
import { generateTransactionId, toMsisdn, isFailedCode } from './theteller'

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

describe('toMsisdn', () => {
  it('converts local, spaced and international forms to 233XXXXXXXXX', () => {
    expect(toMsisdn('0241234567')).toBe('233241234567')
    expect(toMsisdn('024 123 4567')).toBe('233241234567')
    expect(toMsisdn('+233 24 123 4567')).toBe('233241234567')
    expect(toMsisdn('233241234567')).toBe('233241234567')
  })
})

describe('isFailedCode', () => {
  it('treats decline/PIN/funds codes as failed, success and pending as not', () => {
    for (const c of ['100', '101', '102', '103', '104', '105', '114', 103]) expect(isFailedCode(c)).toBe(true)
    for (const c of ['000', '111', '107', undefined]) expect(isFailedCode(c as any)).toBe(false)
  })
})
