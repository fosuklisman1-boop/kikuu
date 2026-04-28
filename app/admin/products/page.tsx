export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'
import Link from 'next/link'
import DeleteProductButton from '@/components/admin/DeleteProductButton'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Products' }

export default async function AdminProductsPage() {
  const admin = createAdminClient()
  const { data: products } = await admin
    .from('products')
    .select('*, categories(name)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Link
          href="/admin/products/new"
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
        >
          + Add Product
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Price</th>
              <th className="px-4 py-3 text-left">Stock</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products?.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {product.images[0] && (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-10 h-10 object-cover rounded-lg"
                      />
                    )}
                    <div>
                      <p className="font-medium text-gray-900 line-clamp-1">{product.name}</p>
                      <p className="text-xs text-gray-400">/{product.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {(product as any).categories?.name ?? '—'}
                </td>
                <td className="px-4 py-3 font-medium">{formatGHS(product.price)}</td>
                <td className="px-4 py-3">
                  <span className={product.stock_qty < 5 ? 'text-red-500 font-medium' : 'text-gray-600'}>
                    {product.stock_qty}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`capitalize text-xs px-2 py-1 rounded-full ${
                    product.status === 'active' ? 'bg-green-100 text-green-700' :
                    product.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                    product.status === 'pre_order' ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {product.status === 'pre_order' ? 'Pre-order' : product.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Edit
                    </Link>
                    <DeleteProductButton id={product.id} name={product.name} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {!products?.length && (
          <p className="text-center text-gray-400 py-12">No products yet.</p>
        )}
      </div>
    </div>
  )
}