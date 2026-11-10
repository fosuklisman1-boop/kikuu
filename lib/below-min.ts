// Pricing for pre-order products bought below their minimum order quantity:
// each unit carries a flat category-level top-up. At or above the minimum
// there is no top-up. Shared by cart, checkout API and storefront display so
// all three always agree.

export function belowMinSurcharge(opts: {
  isPreorder: boolean
  minQty: number | null | undefined
  topup: number | null | undefined
  qty: number
}): number {
  if (!opts.isPreorder || !opts.minQty || !opts.topup) return 0
  return opts.qty < opts.minQty ? opts.topup : 0
}

// Reads the top-up off a product row that was fetched with its category
// joined in (`categories(below_min_topup)`); 0 when absent.
export function productTopup(product: unknown): number {
  const p = product as { categories?: { below_min_topup?: number | null } | null } | null
  return Number(p?.categories?.below_min_topup ?? 0) || 0
}
