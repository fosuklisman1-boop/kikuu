export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteFlashSale } from '@/lib/actions/flash-sales'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export const metadata: Metadata = { title: 'Flash Sales' }

function saleStatus(s: { active: boolean; starts_at: string; ends_at: string }) {
  const now = new Date()
  if (!s.active) return { label: 'Inactive', cls: 'bg-gray-100 text-gray-500' }
  if (new Date(s.starts_at) > now) return { label: 'Scheduled', cls: 'bg-blue-100 text-blue-600' }
  if (new Date(s.ends_at) < now) return { label: 'Ended', cls: 'bg-red-100 text-red-500' }
  return { label: 'Active', cls: 'bg-green-100 text-green-700' }
}

async function handleDelete(id: string) {
  'use server'
  await deleteFlashSale(id)
}

export default async function FlashSalesPage() {
  const admin = createAdminClient()
  const { data: sales } = await admin
    .from('flash_sales')
    .select('*, flash_sale_items(count)')
    .order('starts_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flash Sales</h1>
          <p className="text-sm text-gray-500 mt-0.5">{sales?.length ?? 0} sale{sales?.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/admin/flash-sales/new"
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={15} /> New Flash Sale
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {sales && sales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Starts</th>
                  <th className="px-4 py-3 text-left">Ends</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sales.map((s) => {
                  const status = saleStatus(s)
                  const itemCount = (s.flash_sale_items as unknown as { count: number }[])?.[0]?.count ?? 0
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">{s.title}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(s.starts_at).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(s.ends_at).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">{itemCount}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <Link href={`/admin/flash-sales/${s.id}/edit`}
                            className="text-xs text-blue-600 hover:underline">Edit</Link>
                          <form action={handleDelete.bind(null, s.id)}>
                            <button type="submit"
                              className="text-xs text-red-500 hover:underline"
                              onClick={(e) => { if (!confirm('Delete this flash sale?')) e.preventDefault() }}>
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-gray-400">
            <div className="text-4xl mb-3">⚡</div>
            <p className="font-medium">No flash sales yet</p>
            <Link href="/admin/flash-sales/new" className="text-sm text-green-600 hover:underline mt-1 inline-block">
              Create your first flash sale
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
