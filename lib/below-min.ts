// Pricing for pre-order products that have a minimum order quantity.
//
// Two purchase modes:
//   'bulk'   - quantity must be at least the minimum; base unit price.
//   'single' - any quantity; every unit carries the flat category top-up.
// A line with no mode (e.g. a cart saved before modes existed) falls back to
// the older rule: top-up only while below the minimum.
// Shared by cart, checkout API and storefront display so all agree.

export type PurchaseMode = 'single' | 'bulk'

export function belowMinSurcharge(opts: {
  isPreorder: boolean
  minQty: number | null | undefined
  topup: number | null | undefined
  qty: number
  mode?: PurchaseMode | null
}): number {
  if (!opts.isPreorder || !opts.minQty || !opts.topup) return 0
  if (opts.mode === 'single') return opts.topup
  if (opts.mode === 'bulk') return 0
  return opts.qty < opts.minQty ? opts.topup : 0
}

// Smallest quantity allowed for a line: bulk lines must reach the minimum.
export function minQtyForMode(minQty: number | null | undefined, mode?: PurchaseMode | null): number {
  return mode === 'bulk' && minQty ? minQty : 1
}

// Reads the top-up off a product row that was fetched with its category
// joined in (`categories(below_min_topup)`); 0 when absent.
export function productTopup(product: unknown): number {
  const p = product as { categories?: { below_min_topup?: number | null } | null } | null
  return Number(p?.categories?.below_min_topup ?? 0) || 0
}
