import { describe, it, expect } from 'vitest'
import { getShopSlugFromHost, getShopSlugFromPath, isMarketplaceOnlyPath, resolveShopSubdomainRewrite } from './shop-subdomain'

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

  it('returns null for a multi-level subdomain', () => {
    expect(getShopSlugFromHost('theirshop.staging.kikuu.store', 'kikuu.store')).toBeNull()
  })

  it('lowercases a mixed-case host before extracting the slug', () => {
    expect(getShopSlugFromHost('TheirShop.kikuu.store', 'kikuu.store')).toBe('theirshop')
  })
})

describe('resolveShopSubdomainRewrite', () => {
  it('rewrites the root path to the shop listing route', () => {
    expect(resolveShopSubdomainRewrite('theirshop', '/')).toBe('/shop/theirshop')
  })

  it('rewrites a product path to the shop product route', () => {
    expect(resolveShopSubdomainRewrite('theirshop', '/some-product')).toBe('/shop/theirshop/some-product')
  })

  it.each(['/checkout', '/cart', '/orders', '/api/checkout', '/account/login', '/admin', '/seller/dashboard', '/track'])(
    'passes %s through unrewritten',
    (pathname) => {
      expect(resolveShopSubdomainRewrite('theirshop', pathname)).toBeNull()
    }
  )

  it('does not false-positive on a path that merely starts with a passthrough word', () => {
    expect(resolveShopSubdomainRewrite('theirshop', '/carts-and-things')).toBe('/shop/theirshop/carts-and-things')
  })
})

describe('isMarketplaceOnlyPath', () => {
  it.each(['/products', '/products/some-slug'])('flags %s', (p) => expect(isMarketplaceOnlyPath(p)).toBe(true))
  it('does not flag a shop product that merely starts with the word', () => {
    expect(isMarketplaceOnlyPath('/products-bundle')).toBe(false)
    expect(isMarketplaceOnlyPath('/')).toBe(false)
  })
})

describe('getShopSlugFromPath', () => {
  it('extracts the slug from shop paths', () => {
    expect(getShopSlugFromPath('/shop/theirshop')).toBe('theirshop')
    expect(getShopSlugFromPath('/shop/theirshop/some-product')).toBe('theirshop')
  })
  it('returns null otherwise', () => {
    expect(getShopSlugFromPath('/shops/theirshop')).toBeNull()
    expect(getShopSlugFromPath('/products/x')).toBeNull()
  })
})

describe('products are rewritten on a shop subdomain', () => {
  it('no longer passes /products through', () => {
    expect(resolveShopSubdomainRewrite('theirshop', '/products')).toBe('/shop/theirshop/products')
  })
})
