'use client'

import { createProduct, updateProduct, uploadProductImage } from '@/lib/actions/products'
import type { Product, Category } from '@/lib/supabase/types'
import { useState, useRef } from 'react'
import { X, Upload } from 'lucide-react'

interface Props {
  product?: Product
  categories: Pick<Category, 'id' | 'name' | 'parent_id'>[]
}

export default function ProductForm({ product, categories }: Props) {
  const [images, setImages] = useState<string[]>(product?.images ?? [])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [selectedStatus, setSelectedStatus] = useState(product?.status ?? 'draft')
  const fileRef = useRef<HTMLInputElement>(null)

  const parentCats = categories.filter((c) => !c.parent_id)
  const childCats = categories.filter((c) => c.parent_id)

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadProductImage(fd)
      if (res.error) { setError(res.error); break }
      if (res.url) setImages((prev) => [...prev, res.url!])
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(formData: FormData) {
    images.forEach((url) => formData.append('images', url))
    const result = product
      ? await updateProduct(product.id, formData)
      : await createProduct(formData)
    if (result?.error) {
      const msgs = Object.values(result.error).flat().join(', ')
      setError(msgs)
    }
  }

  return (
    <form action={handleSubmit} className="space-y-5 bg-white rounded-xl border p-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
        <input
          name="name"
          defaultValue={product?.name}
          required
          placeholder="e.g. Samsung Galaxy A55"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
        <select
          name="category_id"
          defaultValue={product?.category_id}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
        >
          <option value="">Select category</option>
          {parentCats.map((p) => (
            <optgroup key={p.id} label={p.name}>
              <option value={p.id}>{p.name}</option>
              {childCats.filter((c) => c.parent_id === p.id).map((c) => (
                <option key={c.id} value={c.id}>&nbsp;&nbsp;{c.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price (GHS) *</label>
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product?.price}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Compare At (GHS)</label>
          <input
            name="compare_at_price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product?.compare_at_price ?? ''}
            placeholder="Original price"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
          />
        </div>
        {selectedStatus !== 'pre_order' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stock Qty *</label>
            <input
              name="stock_qty"
              type="number"
              min="0"
              defaultValue={product?.stock_qty ?? 0}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            />
          </div>
        ) : (
          <input type="hidden" name="stock_qty" value="0" />
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          name="description"
          defaultValue={product?.description ?? ''}
          rows={4}
          placeholder="Describe the product..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-none"
        />
      </div>

      {/* Images */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Product Images</label>
        <div className="flex flex-wrap gap-3 mb-3">
          {images.map((url, i) => (
            <div key={i} className="relative w-20 h-20">
              <img src={url} alt="" className="w-full h-full object-cover rounded-lg border" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-green-500 transition"
          >
            <Upload size={16} />
            <span className="text-xs mt-1">{uploading ? '...' : 'Upload'}</span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            name="status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
          >
            <option value="draft">Draft</option>
            <option value="active">Active (visible to buyers)</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="pre_order">Pre-order</option>
          </select>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input
            type="checkbox"
            name="featured"
            id="featured"
            defaultChecked={product?.featured ?? false}
            value="true"
            className="w-4 h-4 accent-green-600"
          />
          <label htmlFor="featured" className="text-sm font-medium text-gray-700">
            Featured on homepage
          </label>
        </div>
      </div>

      {selectedStatus === 'pre_order' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expected Ship Date *
          </label>
          <input
            name="preorder_ship_date"
            type="date"
            defaultValue={product?.preorder_ship_date ?? ''}
            required={selectedStatus === 'pre_order'}
            min={new Date().toISOString().split('T')[0]}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Shown to customers as the expected delivery window.
          </p>
        </div>
      )}

      <button
        type="submit"
        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition"
      >
        {product ? 'Save Changes' : 'Create Product'}
      </button>
    </form>
  )
}
