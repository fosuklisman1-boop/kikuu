'use client'

import { useState } from 'react'
import type { Product, ProductVariantColor } from '@/lib/supabase/types'
import ProductVariantPicker from '@/components/store/ProductVariantPicker'
import AddToCartButton from '@/components/store/AddToCartButton'

interface Props {
  product: Product
  salePrice?: number
  disabled?: boolean
  variantColors: ProductVariantColor[]
  variantSizes: string[]
}

export default function ProductVariantSection({
  product,
  salePrice,
  disabled,
  variantColors,
  variantSizes,
}: Props) {
  const [selectedColor, setSelectedColor] = useState<ProductVariantColor | null>(null)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)

  const needsColor = variantColors.length > 0 && !selectedColor
  const needsSize = variantSizes.length > 0 && !selectedSize
  const variantBlocked = needsColor || needsSize

  let hint = ''
  if (needsColor && needsSize) hint = 'Select a color and size to continue'
  else if (needsColor) hint = 'Select a color to continue'
  else if (needsSize) hint = 'Select a size to continue'

  return (
    <>
      <ProductVariantPicker
        colors={variantColors}
        sizes={variantSizes}
        selectedColor={selectedColor}
        selectedSize={selectedSize}
        onColorChange={setSelectedColor}
        onSizeChange={setSelectedSize}
      />
      {hint && !disabled && (
        <p className="text-xs text-amber-600 mb-3">{hint}</p>
      )}
      <AddToCartButton
        product={product}
        disabled={disabled || variantBlocked}
        salePrice={salePrice}
        selectedColor={selectedColor ?? undefined}
        selectedSize={selectedSize ?? undefined}
      />
    </>
  )
}
