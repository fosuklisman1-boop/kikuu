'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import {
  createProductColor,
  createProductSize,
  deleteProductColor,
  deleteProductSize,
} from '@/lib/actions/product-options'
import type { ProductColor, ProductSize } from '@/lib/supabase/types'

export default function ProductOptionsManager({
  initialColors,
  initialSizes,
}: {
  initialColors: ProductColor[]
  initialSizes: ProductSize[]
}) {
  const [colors, setColors] = useState(initialColors)
  const [sizes, setSizes] = useState(initialSizes)

  // Color add form
  const [newColorName, setNewColorName] = useState('')
  const [newColorHex, setNewColorHex] = useState('#000000')
  const [addingColor, setAddingColor] = useState(false)
  const [colorError, setColorError] = useState('')

  // Size add form
  const [newSizeName, setNewSizeName] = useState('')
  const [addingSize, setAddingSize] = useState(false)
  const [sizeError, setSizeError] = useState('')

  async function handleAddColor() {
    setColorError('')
    if (!newColorName.trim()) { setColorError('Name is required'); return }
    setAddingColor(true)
    const result = await createProductColor({ name: newColorName, hex: newColorHex })
    setAddingColor(false)
    if (result.error) { setColorError(result.error); return }
    setColors((prev) => [
      ...prev,
      { id: Date.now().toString(), name: newColorName.trim(), hex: newColorHex.toLowerCase(), sort_order: prev.length, active: true, created_at: '' },
    ])
    setNewColorName('')
    setNewColorHex('#000000')
  }

  async function handleDeleteColor(id: string) {
    const result = await deleteProductColor(id)
    if (result.error) { setColorError(result.error); return }
    setColors((prev) => prev.filter((c) => c.id !== id))
  }

  async function handleAddSize() {
    setSizeError('')
    if (!newSizeName.trim()) { setSizeError('Name is required'); return }
    setAddingSize(true)
    const result = await createProductSize({ name: newSizeName })
    setAddingSize(false)
    if (result.error) { setSizeError(result.error); return }
    setSizes((prev) => [
      ...prev,
      { id: Date.now().toString(), name: newSizeName.trim(), sort_order: prev.length, active: true, created_at: '' },
    ])
    setNewSizeName('')
  }

  async function handleDeleteSize(id: string) {
    const result = await deleteProductSize(id)
    if (result.error) { setSizeError(result.error); return }
    setSizes((prev) => prev.filter((s) => s.id !== id))
  }

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500'
  const panelCls = 'bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4'

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Colors */}
      <div className={panelCls}>
        <h2 className="font-semibold text-gray-900">Colors</h2>
        {colorError && <p className="text-red-500 text-sm">{colorError}</p>}
        <div className="flex gap-2">
          <input
            value={newColorName}
            onChange={(e) => setNewColorName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddColor()}
            placeholder="e.g. Red"
            className={`flex-1 ${inputCls}`}
          />
          <input
            type="color"
            value={newColorHex}
            onChange={(e) => setNewColorHex(e.target.value)}
            className="w-10 h-9 rounded-lg border border-gray-200 cursor-pointer"
            title="Pick color"
          />
          <button
            onClick={handleAddColor}
            disabled={addingColor}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {colors.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No colors yet.</p>
          )}
          {colors.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2.5">
              <span
                className="w-5 h-5 rounded-full border border-gray-200 shrink-0"
                style={{ background: c.hex }}
              />
              <span className="flex-1 text-sm text-gray-800">{c.name}</span>
              <span className="text-xs text-gray-400 font-mono">{c.hex}</span>
              <button
                onClick={() => handleDeleteColor(c.id)}
                className="text-gray-300 hover:text-red-400 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sizes */}
      <div className={panelCls}>
        <h2 className="font-semibold text-gray-900">Sizes</h2>
        {sizeError && <p className="text-red-500 text-sm">{sizeError}</p>}
        <div className="flex gap-2">
          <input
            value={newSizeName}
            onChange={(e) => setNewSizeName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSize()}
            placeholder="e.g. XL or 42"
            className={`flex-1 ${inputCls}`}
          />
          <button
            onClick={handleAddSize}
            disabled={addingSize}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {sizes.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No sizes yet.</p>
          )}
          {sizes.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5">
              <span className="flex-1 text-sm text-gray-800">{s.name}</span>
              <button
                onClick={() => handleDeleteSize(s.id)}
                className="text-gray-300 hover:text-red-400 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
