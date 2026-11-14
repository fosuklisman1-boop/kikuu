import { describe, it, expect } from 'vitest'
import { isDeliveryStatus, DELIVERY_STEPS, PAID_UPDATE, FAILED_UPDATE, legacyForDelivery } from './order-status'

describe('order-status', () => {
  it('accepts only the three delivery steps', () => {
    for (const s of DELIVERY_STEPS) expect(isDeliveryStatus(s)).toBe(true)
    for (const s of ['paid', 'cancelled', 'refunded', '', null, undefined]) expect(isDeliveryStatus(s)).toBe(false)
  })
  it('a confirmed payment starts delivery at processing', () => {
    expect(PAID_UPDATE).toEqual({ status: 'paid', payment_status: 'paid', delivery_status: 'processing' })
  })
  it('a failed payment is cancelled and marked failed', () => {
    expect(FAILED_UPDATE).toEqual({ status: 'cancelled', payment_status: 'failed' })
  })
  it('delivery steps map to the same legacy status', () => {
    expect(legacyForDelivery('shipped')).toBe('shipped')
  })
})
