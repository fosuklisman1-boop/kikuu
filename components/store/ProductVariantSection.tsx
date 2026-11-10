'use client'

import { useState } from 'react'
import type { PurchaseMode } from '@/lib/below-min'
import type { Product, ProductVariantColor } from '@/lib/supabase/types'
import ProductVariantPicker from '@/components/store/ProductVariantPicker'
import AddToCartButton from '@/components/store/AddToCartButton'

interface Props {
  product: Product
  salePrice?: number
  disabled?: boolean
  variantColors: ProductVariantColor[]
  variantSizes: string[]
  shopId?: string
  shopSlug?: string
  shopPrice?: number
}

export default function ProductVariantSection({
  product,
  salePrice,
  disabled,
  variantColors,
  variantSizes,
  shopId,
  shopSlug,
  shopPrice,
}: Props) {
  const [selectedColor, setSelectedColor] = useState<ProductVariantColor | null>(null)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)

  // Single purchases pick color/size per unit inside the add-to-cart box
  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode | undefined>(undefined)
  const perUnitMode = purchaseMode === 'single'
  // Bulk orders choose a color only; size isn't part of a bulk purchase
  const bulkMode = purchaseMode === 'bulk'
  const pickerSizes = bulkMode ? [] : variantSizes

  const needsColor = variantColors.length > 0 && !selectedColor
  const needsSize = pickerSizes.length > 0 && !selectedSize
  const variantBlocked = needsColor || needsSize

  let hint = ''
  if (needsColor && needsSize) hint = 'Select a color and size to continue'
  else if (needsColor) hint = 'Select a color to continue'
  else if (needsSize) hint = 'Select a size to continue'

  return (
    <>
      {!perUnitMode && (
        <ProductVariantPicker
          colors={variantColors}
          sizes={pickerSizes}
          selectedColor={selectedColor}
          selectedSize={selectedSize}
          onColorChange={setSelectedColor}
          onSizeChange={setSelectedSize}
        />
      )}
      <AddToCartButton
        product={product}
        disabled={disabled}
        selectionHint={!disabled && !perUnitMode && variantBlocked ? hint : undefined}
        variantColors={variantColors}
        variantSizes={variantSizes}
        onModeChange={setPurchaseMode}
        salePrice={salePrice}
        selectedColor={selectedColor ?? undefined}
        selectedSize={bulkMode ? undefined : selectedSize ?? undefined}
        shopId={shopId}
        shopSlug={shopSlug}
        shopPrice={shopPrice}
      />
    </>
  )
}
