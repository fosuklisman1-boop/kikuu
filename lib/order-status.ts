// Order state is split in two:
//   payment_status  - set by the payment gateways (and refunds); admin never edits it
//   delivery_status - set by admin once an order is paid
// The legacy orders.status column is still written (derived below) so customer
// pages, the reconciliation job and seller earnings keep working.

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type DeliveryStatus = 'processing' | 'shipped' | 'delivered'
export type LegacyOrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'

export const DELIVERY_STEPS: DeliveryStatus[] = ['processing', 'shipped', 'delivered']

export const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
}

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: 'Payment pending',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
}

export function isDeliveryStatus(v: unknown): v is DeliveryStatus {
  return typeof v === 'string' && (DELIVERY_STEPS as string[]).includes(v)
}

// What a gateway writes the moment it confirms payment.
export const PAID_UPDATE = {
  status: 'paid',
  payment_status: 'paid',
  delivery_status: 'processing',
} as const

// What a gateway writes when a payment definitively fails.
export const FAILED_UPDATE = { status: 'cancelled', payment_status: 'failed' } as const

// Legacy status for an admin delivery step.
export function legacyForDelivery(d: DeliveryStatus): LegacyOrderStatus {
  return d
}
