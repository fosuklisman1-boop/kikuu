'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrand, updateBrand, assignProductBrand } from '@/lib/actions/brands'
import type { Brand, Product } from '@/lib/supabase/types'

export default function BrandForm({
  brand,
  linkedProducts,
  allProducts,
}: {
  brand?: Brand
  linkedProducts?: Product[]
  allProducts?: Product[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [linked, setLinked] = useState<Product[]>(linkedProducts ?? [])

  const unlinkedProducts = (allProducts ?? []).filter(
    (p) => !linked.some((l) => l.id === p.id) &&
      p.name.toLowerCase().includes(productSearch.toLowerCase())
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const result = brand ? await updateBrand(brand.id, fd) : await createBrand(fd)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    router.push('/admin/brands')
  }

  async function handleLink(product: Product) {
    await assignProductBrand(product.id, brand!.id)
    setLinked((prev) => [...prev, product])
    setProductSearch('')
  }

  async function handleUnlink(product: Product) {
    await assignProductBrand(product.id, null)
    setLinked((prev) => prev.filter((p) => p.id !== product.id))
  }

  return (
    <div className="space-y-6 max-w-xl">
      {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Brand Details</h2>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
          <input name="name" defaultValue={brand?.name} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Logo URL *</label>
          <input name="logo_url" defaultValue={brand?.logo_url} required type="url"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sort Order</label>
          <input name="sort_order" type="number" defaultValue={brand?.sort_order ?? 0}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input name="active" type="checkbox" defaultChecked={brand?.active ?? true} className="rounded" />
          Active
        </label>
        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl disabled:opacity-50">
            {loading ? 'Saving…' : brand ? 'Update Brand' : 'Create Brand'}
          </button>
          <button type="button" onClick={() => router.push('/admin/brands')}
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5">Cancel</button>
        </div>
      </form>

      {/* Link products — only shown in edit mode */}
      {brand && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Linked Products ({linked.length})</h2>
          <div className="relative">
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search products to link…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            {productSearch && unlinkedProducts.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {unlinkedProducts.slice(0, 6).map((p) => (
                  <button key={p.id} type="button" onClick={() => handleLink(p)}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-left text-sm">
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-green-600 text-xs font-medium">+ Link</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {linked.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-800">{p.name}</span>
              <button onClick={() => handleUnlink(p)} className="text-xs text-red-500 hover:underline">Unlink</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
