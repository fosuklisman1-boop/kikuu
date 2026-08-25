export function computeShopPrice(
  basePrice: number,
  markupType: 'flat' | 'percentage',
  markupValue: number
): number {
  const raw = markupType === 'flat'
    ? basePrice + markupValue
    : basePrice * (1 + markupValue / 100)
  return Math.round(raw * 100) / 100
}
