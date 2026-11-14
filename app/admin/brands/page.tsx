export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteBrand } from '@/lib/actions/brands'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import DeleteButton from '@/components/admin/DeleteButton'
import { SearchScope, SearchItem } from '@/components/ui/InstantSearch'

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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Brands</h1>
          <p className="text-sm text-slate-500 mt-0.5">{brands?.length ?? 0} brand{brands?.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/admin/brands/new"
          className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={15} /> New Brand
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {brands && brands.length > 0 ? (
          <SearchScope placeholder="Search brands…" barClassName="mb-0 px-4 py-3">
          <div className="divide-y divide-slate-100">
            {brands.map((b) => (
              <SearchItem key={b.id} text={`${b.name} ${b.slug}`} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                <img src={b.logo_url} alt={b.name} className="w-12 h-12 object-contain rounded-lg bg-slate-100 p-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">{b.name}</p>
                  <p className="text-slate-400 text-xs">/{b.slug}</p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${b.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                  {b.active ? 'Active' : 'Hidden'}
                </span>
                <div className="flex gap-3">
                  <Link href={`/admin/brands/${b.id}/edit`} className="text-xs text-blue-600 hover:underline">Edit</Link>
                  <DeleteButton
                    action={handleDelete.bind(null, b.id)}
                    confirmMessage="Delete brand?"
                  />
                </div>
              </SearchItem>
            ))}
          </div>
          </SearchScope>
        ) : (
          <div className="py-16 text-center text-slate-400">
            <div className="text-4xl mb-3">🏢</div>
            <p className="font-medium">No brands yet</p>
            <Link href="/admin/brands/new" className="text-sm text-emerald-600 hover:underline mt-1 inline-block">Add your first brand</Link>
          </div>
        )}
      </div>
    </div>
  )
}
