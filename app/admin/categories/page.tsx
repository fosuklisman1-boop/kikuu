export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import DeleteCategoryButton from '@/components/admin/DeleteCategoryButton'
import CategoryForm from '@/components/admin/CategoryForm'

export const metadata: Metadata = { title: 'Categories' }

export default async function AdminCategoriesPage() {
  const admin = createAdminClient()
  const { data: categories } = await admin
    .from('categories')
    .select('*')
    .order('sort_order')

  const parents = categories?.filter((c) => !c.parent_id) ?? []
  const children = categories?.filter((c) => c.parent_id) ?? []

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Categories</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Add new category */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Add Category</h2>
          <CategoryForm parents={parents} />
        </div>

        {/* Category list */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">All Categories ({categories?.length ?? 0})</h2>
          </div>
          <div className="divide-y max-h-[500px] overflow-y-auto">
            {parents.map((parent) => (
              <div key={parent.id}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{parent.name}</p>
                    <p className="text-xs text-gray-400">/{parent.slug}</p>
                  </div>
                  <DeleteCategoryButton id={parent.id} name={parent.name} />
                </div>
                {children
                  .filter((c) => c.parent_id === parent.id)
                  .map((child) => (
                    <div key={child.id} className="flex items-center justify-between px-4 py-2 bg-gray-50">
                      <div className="pl-4">
                        <p className="text-sm text-gray-700">↳ {child.name}</p>
                        <p className="text-xs text-gray-400">/{child.slug}</p>
                      </div>
                      <DeleteCategoryButton id={child.id} name={child.name} />
                    </div>
                  ))}
              </div>
            ))}
            {!categories?.length && (
              <p className="text-center text-gray-400 py-8 text-sm">No categories yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
