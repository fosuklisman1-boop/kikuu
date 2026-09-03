import { describe, it, expect } from 'vitest'
import { getCookieDomain } from './cookie-domain'

describe('getCookieDomain', () => {
  it('returns the shared domain for the bare root domain', () => {
    expect(getCookieDomain('telomall.com', 'telomall.com')).toBe('.telomall.com')
  })

  it('returns the shared domain for www', () => {
    expect(getCookieDomain('www.telomall.com', 'telomall.com')).toBe('.telomall.com')
  })

  it('returns the shared domain for a shop subdomain', () => {
    expect(getCookieDomain('theirshop.telomall.com', 'telomall.com')).toBe('.telomall.com')
  })

  it('returns undefined for an unrelated host', () => {
    expect(getCookieDomain('kikuu-seven.vercel.app', 'telomall.com')).toBeUndefined()
  })

  it('returns undefined for localhost', () => {
    expect(getCookieDomain('localhost:3000', 'telomall.com')).toBeUndefined()
  })

  it('returns undefined when rootDomain is empty (feature off)', () => {
    expect(getCookieDomain('theirshop.telomall.com', '')).toBeUndefined()
  })

  it('is case-insensitive on the host', () => {
    expect(getCookieDomain('TheirShop.Telomall.com', 'telomall.com')).toBe('.telomall.com')
  })

  it('strips the port before comparing', () => {
    expect(getCookieDomain('telomall.com:3000', 'telomall.com')).toBe('.telomall.com')
  })

  it('rejects a lookalike domain that is not a real subdomain', () => {
    expect(getCookieDomain('evil-telomall.com', 'telomall.com')).toBeUndefined()
  })
})
