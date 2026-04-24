'use client'

import type { ProductVariantColor } from '@/lib/supabase/types'

interface Props {
  colors: ProductVariantColor[]
  sizes: string[]
  selectedColor: ProductVariantColor | null
  selectedSize: string | null
  onColorChange: (color: ProductVariantColor | null) => void
  onSizeChange: (size: string | null) => void
}

export default function ProductVariantPicker({
  colors,
  sizes,
  selectedColor,
  selectedSize,
  onColorChange,
  onSizeChange,
}: Props) {
  return (
    <div className="space-y-4 mb-6">
      {colors.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Color{selectedColor ? `: ${selectedColor.name}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
              const active = selectedColor?.name === c.name
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => onColorChange(active ? null : c)}
                  title={c.name}
                  className={`w-9 h-9 rounded-full border-2 transition-all ${
                    active ? 'border-gray-900 scale-110' : 'border-transparent hover:border-gray-400'
                  }`}
                  style={{ background: c.hex }}
                  aria-label={c.name}
                  aria-pressed={active}
                />
              )
            })}
          </div>
        </div>
      )}

      {sizes.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Size{selectedSize ? `: ${selectedSize}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const active = selectedSize === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSizeChange(active ? null : s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    active
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 text-gray-700 hover:border-gray-400'
                  }`}
                  aria-pressed={active}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
