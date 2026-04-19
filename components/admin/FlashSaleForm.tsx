'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createFlashSale, updateFlashSale, type FlashSaleItemInput } from '@/lib/actions/flash-sales'
import type { FlashSaleWithItems, Product } from '@/lib/supabase/types'
import { formatGHS } from '@/lib/utils'
import { X, Plus } from 'lucide-react'

export default function FlashSaleForm({
  sale,
  allProducts,
}: {
  sale?: FlashSaleWithItems
  allProducts: Product[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState<Array<FlashSaleItemInput & { name: string; image: string }>>(
    sale?.items.map((i) => ({
      product_id: i.product_id,
      sale_price: i.sale_price,
      sort_order: i.sort_order,
      name: i.product.name,
      image: i.product.images?.[0] ?? '',
    })) ?? []
  )
  const [productSearch, setProductSearch] = useState('')

  const filteredProducts = allProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
      !items.some((i) => i.product_id === p.id)
  )

  function addProduct(p: Product) {
    setItems((prev) => [
      ...prev,
      { product_id: p.id, sale_price: p.price, sort_order: prev.length, name: p.name, image: p.images?.[0] ?? '' },
    ])
    setProductSearch('')
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.product_id !== productId))
  }

  function updatePrice(productId: string, price: number) {
    setItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, sale_price: price } : i))
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const payload = {
      title: fd.get('title') as string,
      starts_at: new Date(fd.get('starts_at') as string).toISOString(),
      ends_at: new Date(fd.get('ends_at') as string).toISOString(),
      active: fd.get('active') === 'on',
      items: items.map(({ product_id, sale_price, sort_order }) => ({ product_id, sale_price, sort_order })),
    }
    const result = sale
      ? await updateFlashSale(sale.id, payload.title, payload.starts_at, payload.ends_at, payload.active, payload.items)
      : await createFlashSale(payload.title, payload.starts_at, payload.ends_at, payload.active, payload.items)

    setLoading(false)
    if (result.error) { setError(result.error); return }
    router.push('/admin/flash-sales')
  }

  function toLocalDatetime(iso: string) {
    const d = new Date(iso)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Sale Details</h2>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
          <input name="title" defaultValue={sale?.title} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Starts At *</label>
            <input name="starts_at" type="datetime-local" required
              defaultValue={sale ? toLocalDatetime(sale.starts_at) : ''}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ends At *</label>
            <input name="ends_at" type="datetime-local" required
              defaultValue={sale ? toLocalDatetime(sale.ends_at) : ''}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input name="active" type="checkbox" defaultChecked={sale?.active ?? true} className="rounded" />
          Active
        </label>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Sale Items ({items.length})</h2>

        {/* Product search */}
        <div className="relative">
          <input
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Search products to add…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          {productSearch && filteredProducts.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredProducts.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 text-left text-sm"
                >
                  {p.images?.[0] && (
                    <img src={p.images[0]} alt={p.name} className="w-8 h-8 object-cover rounded" />
                  )}
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-gray-400 text-xs">{formatGHS(p.price)}</span>
                  <Plus size={14} className="text-green-600 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items list */}
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">No items yet. Search above to add products.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.product_id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                {item.image && (
                  <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded" />
                )}
                <span className="flex-1 text-sm font-medium text-gray-900 truncate">{item.name}</span>
                <div>
                  <label className="text-[10px] text-gray-400 block">Sale Price (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.sale_price}
                    onChange={(e) => updatePrice(item.product_id, Number(e.target.value))}
                    className="w-28 border border-gray-200 rounded px-2 py-1 text-sm"
                  />
                </div>
                <button type="button" onClick={() => removeItem(item.product_id)}
                  className="text-red-400 hover:text-red-600 ml-1">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl disabled:opacity-50">
          {loading ? 'Saving…' : sale ? 'Update Sale' : 'Create Sale'}
        </button>
        <button type="button" onClick={() => router.push('/admin/flash-sales')}
          className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5">
          Cancel
        </button>
      </div>
    </form>
  )
}
