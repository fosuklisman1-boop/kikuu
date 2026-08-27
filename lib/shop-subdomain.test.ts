import { describe, it, expect } from 'vitest'
import { getShopSlugFromHost, resolveShopSubdomainRewrite } from './shop-subdomain'

describe('getShopSlugFromHost', () => {
  it('returns the slug for a shop subdomain', () => {
    expect(getShopSlugFromHost('theirshop.kikuu.store', 'kikuu.store')).toBe('theirshop')
  })

  it('returns null for the bare root domain', () => {
    expect(getShopSlugFromHost('kikuu.store', 'kikuu.store')).toBeNull()
  })

  it('returns null for www', () => {
    expect(getShopSlugFromHost('www.kikuu.store', 'kikuu.store')).toBeNull()
  })

  it('returns null for an unrelated host', () => {
    expect(getShopSlugFromHost('example.com', 'kikuu.store')).toBeNull()
  })

  it('returns null when rootDomain is empty (feature off)', () => {
    expect(getShopSlugFromHost('theirshop.kikuu.store', '')).toBeNull()
  })

  it('strips the port before comparing', () => {
    expect(getShopSlugFromHost('theirshop.kikuu.store:3000', 'kikuu.store')).toBe('theirshop')
  })
})

describe('resolveShopSubdomainRewrite', () => {
  it('rewrites the root path to the shop listing route', () => {
    expect(resolveShopSubdomainRewrite('theirshop', '/')).toBe('/shop/theirshop')
  })

  it('rewrites a product path to the shop product route', () => {
    expect(resolveShopSubdomainRewrite('theirshop', '/some-product')).toBe('/shop/theirshop/some-product')
  })

  it.each(['/checkout', '/cart', '/api/checkout', '/account/login', '/admin', '/seller/dashboard', '/products'])(
    'passes %s through unrewritten',
    (pathname) => {
      expect(resolveShopSubdomainRewrite('theirshop', pathname)).toBeNull()
    }
  )

  it('does not false-positive on a path that merely starts with a passthrough word', () => {
    expect(resolveShopSubdomainRewrite('theirshop', '/carts-and-things')).toBe('/shop/theirshop/carts-and-things')
  })
})
