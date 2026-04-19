export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteBrand } from '@/lib/actions/brands'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import DeleteButton from '@/components/admin/DeleteButton'

export const metadata: Metadata = { title: 'Brands' }

async function handleDelete(id: string) {
  'use server'
  await deleteBrand(id)
}

export default async function BrandsPage() {
  const admin = createAdminClient()
  const { data: brands } = await admin.from('brands').select('*').order('sort_order')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brands</h1>
          <p className="text-sm text-gray-500 mt-0.5">{brands?.length ?? 0} brand{brands?.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/admin/brands/new"
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={15} /> New Brand
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {brands && brands.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {brands.map((b) => (
              <div key={b.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
                <img src={b.logo_url} alt={b.name} className="w-12 h-12 object-contain rounded-lg bg-gray-100 p-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{b.name}</p>
                  <p className="text-gray-400 text-xs">/{b.slug}</p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${b.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {b.active ? 'Active' : 'Hidden'}
                </span>
                <div className="flex gap-3">
                  <Link href={`/admin/brands/${b.id}/edit`} className="text-xs text-blue-600 hover:underline">Edit</Link>
                  <DeleteButton
                    action={handleDelete.bind(null, b.id)}
                    confirmMessage="Delete brand?"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-gray-400">
            <div className="text-4xl mb-3">🏢</div>
            <p className="font-medium">No brands yet</p>
            <Link href="/admin/brands/new" className="text-sm text-green-600 hover:underline mt-1 inline-block">Add your first brand</Link>
          </div>
        )}
      </div>
    </div>
  )
}
