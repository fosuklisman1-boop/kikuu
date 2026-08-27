import { describe, it, expect } from 'vitest'
import { shopUrl, shopProductHref } from './shop-url'

describe('shopUrl', () => {
  it('falls back to the path-based route when NEXT_PUBLIC_ROOT_DOMAIN is unset', () => {
    expect(shopUrl('theirshop')).toBe('/shop/theirshop')
  })
})

describe('shopProductHref', () => {
  it('builds a clean relative link when on the subdomain', () => {
    expect(shopProductHref('theirshop', 'some-product', true)).toBe('/some-product')
  })

  it('builds a full path-based link when not on the subdomain', () => {
    expect(shopProductHref('theirshop', 'some-product', false)).toBe('/shop/theirshop/some-product')
  })
})
