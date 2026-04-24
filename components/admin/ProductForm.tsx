'use client'

import { createProduct, updateProduct } from '@/lib/actions/products'
import { createProductColor, createProductSize } from '@/lib/actions/product-options'
import type { Product, Category } from '@/lib/supabase/types'
import type { ProductColor, ProductSize, ProductAttributes, ProductVariantColor } from '@/lib/supabase/types'
import { useState, useRef } from 'react'
import { X, Upload, Film } from 'lucide-react'

interface Props {
  product?: Product
  categories: Pick<Category, 'id' | 'name' | 'parent_id'>[]
  allColors: ProductColor[]
  allSizes: ProductSize[]
}

export default function ProductForm({ product, categories, allColors, allSizes }: Props) {
  const [images, setImages] = useState<string[]>(product?.images ?? [])
  const [videos, setVideos] = useState<string[]>((product as any)?.videos ?? [])
  const [imageProgress, setImageProgress] = useState<number | null>(null)
  const [videoProgress, setVideoProgress] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [selectedStatus, setSelectedStatus] = useState(product?.status ?? 'draft')
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  const attrs = (product?.attributes ?? {}) as ProductAttributes
  const [selectedColors, setSelectedColors] = useState<ProductVariantColor[]>(attrs.colors ?? [])
  const [selectedSizes, setSelectedSizes] = useState<string[]>(attrs.sizes ?? [])
  const [extraColors, setExtraColors] = useState<ProductColor[]>([])
  const [extraSizes, setExtraSizes] = useState<ProductSize[]>([])
  const allAvailableColors = [...allColors, ...extraColors]
  const allAvailableSizes = [...allSizes, ...extraSizes]

  // Inline new color form
  const [showNewColor, setShowNewColor] = useState(false)
  const [newColorName, setNewColorName] = useState('')
  const [newColorHex, setNewColorHex] = useState('#000000')
  const [addingColor, setAddingColor] = useState(false)
  const [colorAddError, setColorAddError] = useState('')

  // Inline new size form
  const [showNewSize, setShowNewSize] = useState(false)
  const [newSizeName, setNewSizeName] = useState('')
  const [addingSize, setAddingSize] = useState(false)
  const [sizeAddError, setSizeAddError] = useState('')

  const parentCats = categories.filter((c) => !c.parent_id)
  const childCats = categories.filter((c) => c.parent_id)

  function xhrUpload(
    url: string,
    file: File,
    onProgress: (pct: number) => void,
  ): Promise<{ url?: string; error?: string }> {
    return new Promise((resolve) => {
      const fd = new FormData()
      fd.append('file', file)
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => {
        try { resolve(JSON.parse(xhr.responseText)) } catch { resolve({ error: 'Upload failed' }) }
      }
      xhr.onerror = () => resolve({ error: 'Network error' })
      xhr.send(fd)
    })
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setError('')
    for (const file of files) {
      setImageProgress(0)
      const res = await xhrUpload('/api/upload/image', file, setImageProgress)
      if (res.error) { setError(res.error); setImageProgress(null); break }
      if (res.url) setImages((prev) => [...prev, res.url!])
      setImageProgress(null)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleAddColor() {
    setColorAddError('')
    if (!newColorName.trim()) { setColorAddError('Name is required'); return }
    setAddingColor(true)
    const result = await createProductColor({ name: newColorName, hex: newColorHex })
    setAddingColor(false)
    if (result.error) { setColorAddError(result.error); return }
    const newOpt: ProductColor = {
      id: Date.now().toString(), name: newColorName.trim(),
      hex: newColorHex.toLowerCase(), sort_order: allAvailableColors.length,
      active: true, created_at: '',
    }
    setExtraColors((prev) => [...prev, newOpt])
    setSelectedColors((prev) => [...prev, { name: newOpt.name, hex: newOpt.hex }])
    setShowNewColor(false)
    setNewColorName('')
    setNewColorHex('#000000')
  }

  async function handleAddSize() {
    setSizeAddError('')
    if (!newSizeName.trim()) { setSizeAddError('Name is required'); return }
    setAddingSize(true)
    const result = await createProductSize({ name: newSizeName })
    setAddingSize(false)
    if (result.error) { setSizeAddError(result.error); return }
    const newOpt: ProductSize = {
      id: Date.now().toString(), name: newSizeName.trim(),
      sort_order: allAvailableSizes.length, active: true, created_at: '',
    }
    setExtraSizes((prev) => [...prev, newOpt])
    setSelectedSizes((prev) => [...prev, newOpt.name])
    setShowNewSize(false)
    setNewSizeName('')
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setError('')
    for (const file of files) {
      console.log('[video] uploading', file.name, file.type, file.size)
      setVideoProgress(0)
      const res = await xhrUpload('/api/upload/video', file, setVideoProgress)
      console.log('[video] response', res)
      if (res.error) { setError(res.error); setVideoProgress(null); break }
      if (res.url) {
        setVideos((prev) => { console.log('[video] new videos', [...prev, res.url!]); return [...prev, res.url!] })
      } else {
        setError('Upload succeeded but no URL returned. Check server logs.')
      }
      setVideoProgress(null)
    }
    if (videoRef.current) videoRef.current.value = ''
  }

  async function handleSubmit(formData: FormData) {
    images.forEach((url) => formData.append('images', url))
    videos.forEach((url) => formData.append('videos', url))
    console.log('[submit] images', images, 'videos', videos)
    console.log('[submit] formData videos', formData.getAll('videos'))
    formData.set('attributes', JSON.stringify({ colors: selectedColors, sizes: selectedSizes }))
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
      {images.map((url, i) => <input key={i} type="hidden" name="images" value={url} />)}
      {videos.map((url, i) => <input key={i} type="hidden" name="videos" value={url} />)}
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

      {/* Colors */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Colors</label>
        {allAvailableColors.length > 0 && (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 mb-2">
            <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedColors.length === 0}
                onChange={() => setSelectedColors([])}
                className="w-4 h-4 accent-green-600 shrink-0"
              />
              <span className="text-sm text-gray-500 italic">None</span>
            </label>
            {allAvailableColors.map((c) => {
              const checked = selectedColors.some((s) => s.name === c.name)
              return (
                <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedColors((prev) =>
                        checked
                          ? prev.filter((s) => s.name !== c.name)
                          : [...prev, { name: c.name, hex: c.hex }]
                      )
                    }
                    className="w-4 h-4 accent-green-600 shrink-0"
                  />
                  <span className="w-4 h-4 rounded-full border border-gray-200 shrink-0" style={{ background: c.hex }} />
                  <span className="text-sm text-gray-800">{c.name}</span>
                </label>
              )
            })}
          </div>
        )}
        {!showNewColor ? (
          <button type="button" onClick={() => setShowNewColor(true)}
            className="text-xs text-green-600 hover:text-green-700 font-semibold flex items-center gap-1">
            + Add color
          </button>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
            {colorAddError && <p className="text-red-500 text-xs">{colorAddError}</p>}
            <div className="flex gap-2">
              <input value={newColorName} onChange={(e) => setNewColorName(e.target.value)}
                placeholder="Name (e.g. Red)" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-500" />
              <input type="color" value={newColorHex} onChange={(e) => setNewColorHex(e.target.value)}
                className="w-9 h-8 rounded border border-gray-200 cursor-pointer" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleAddColor} disabled={addingColor}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
                {addingColor ? 'Adding…' : 'Add'}
              </button>
              <button type="button" onClick={() => { setShowNewColor(false); setColorAddError('') }}
                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sizes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Sizes</label>
        {allAvailableSizes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
              selectedSizes.length === 0 ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-200 text-gray-500 hover:border-gray-400'
            }`}>
              <input
                type="checkbox"
                checked={selectedSizes.length === 0}
                onChange={() => setSelectedSizes([])}
                className="w-3.5 h-3.5 accent-green-600 shrink-0"
              />
              <span className="italic">None</span>
            </label>
            {allAvailableSizes.map((s) => {
              const checked = selectedSizes.includes(s.name)
              return (
                <label key={s.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                  checked ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-200 text-gray-700 hover:border-gray-400'
                }`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedSizes((prev) =>
                        checked ? prev.filter((n) => n !== s.name) : [...prev, s.name]
                      )
                    }
                    className="w-3.5 h-3.5 accent-green-600 shrink-0"
                  />
                  {s.name}
                </label>
              )
            })}
          </div>
        )}
        {!showNewSize ? (
          <button type="button" onClick={() => setShowNewSize(true)}
            className="text-xs text-green-600 hover:text-green-700 font-semibold flex items-center gap-1">
            + Add size
          </button>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
            {sizeAddError && <p className="text-red-500 text-xs">{sizeAddError}</p>}
            <div className="flex gap-2">
              <input value={newSizeName} onChange={(e) => setNewSizeName(e.target.value)}
                placeholder="e.g. XL or 42" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-500" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleAddSize} disabled={addingSize}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
                {addingSize ? 'Adding…' : 'Add'}
              </button>
              <button type="button" onClick={() => { setShowNewSize(false); setSizeAddError('') }}
                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
                Cancel
              </button>
            </div>
          </div>
        )}
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
            disabled={imageProgress !== null}
            className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-green-500 transition"
          >
            <Upload size={16} />
            <span className="text-xs mt-1">{imageProgress !== null ? `${imageProgress}%` : 'Upload'}</span>
          </button>
        </div>
        {imageProgress !== null && (
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all duration-150"
              style={{ width: `${imageProgress}%` }}
            />
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>

      {/* Videos */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Product Videos</label>
        <div className="flex flex-wrap gap-3 mb-3">
          {videos.map((url, i) => (
            <div key={i} className="relative w-20 h-20">
              <a href={url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                <div className="w-full h-full bg-gray-800 rounded-lg border border-gray-300 flex flex-col items-center justify-center gap-1">
                  <Film size={20} className="text-gray-300" />
                  <span className="text-gray-400 text-[9px]">Video</span>
                </div>
              </a>
              <button
                type="button"
                onClick={() => setVideos((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => videoRef.current?.click()}
            disabled={videoProgress !== null}
            className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-green-500 transition"
          >
            <Upload size={16} />
            <span className="text-xs mt-1">{videoProgress !== null ? `${videoProgress}%` : 'Video'}</span>
          </button>
        </div>
        {videoProgress !== null && (
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all duration-150"
              style={{ width: `${videoProgress}%` }}
            />
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">MP4, WebM or MOV · max 50MB each</p>
        <input
          ref={videoRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          multiple
          className="hidden"
          onChange={handleVideoUpload}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            name="status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as 'active' | 'draft' | 'out_of_stock' | 'pre_order')}
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
