export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'
import Link from 'next/link'
import DeleteProductButton from '@/components/admin/DeleteProductButton'
import type { Metadata } from 'next'
import { SearchScope, SearchItem } from '@/components/ui/InstantSearch'
import { PageHeader, Panel, Badge, EmptyState, Stat, TH, THR, TD, ROW, THEAD, TBODY, LINK } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Products' }

const STATUS_TONE = { active: 'green', draft: 'gray', pre_order: 'amber', out_of_stock: 'red' } as const
const STATUS_LABEL: Record<string, string> = { active: 'Active', draft: 'Draft', pre_order: 'Pre-order', out_of_stock: 'Out of stock' }

export default async function AdminProductsPage() {
  const admin = createAdminClient()
  const { data: products } = await admin
    .from('products')
    .select('*, categories(name)')
    .order('created_at', { ascending: false })

  const list = products ?? []
  const active = list.filter((p) => p.status === 'active').length
  const preorder = list.filter((p) => p.status === 'pre_order').length
  const low = list.filter((p) => p.status === 'active' && p.stock_qty < 5).length

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Products"
        description={`${list.length} product${list.length === 1 ? '' : 's'}`}
        action={{ href: '/admin/products/new', label: 'Add product' }}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Active" value={active} />
        <Stat label="Pre-order" value={preorder} />
        <Stat label="Low stock" value={low} hint="Active, fewer than 5 left" />
      </div>

      <Panel className="overflow-hidden">
        {list.length === 0 ? (
          <EmptyState title="No products yet" hint="Add your first product to start selling." action={{ href: '/admin/products/new', label: 'Add product' }} />
        ) : (
          <div className="overflow-x-auto">
            <SearchScope placeholder="Search products by name, slug or category" barClassName="mb-0 px-4 pt-3 pb-2">
              <table className="min-w-full text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className={TH}>Product</th>
                    <th className={TH}>Category</th>
                    <th className={THR}>Price</th>
                    <th className={THR}>Stock</th>
                    <th className={TH}>Status</th>
                    <th className={THR}>Actions</th>
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {list.map((product) => (
                    <SearchItem
                      as="tr"
                      key={product.id}
                      text={`${product.name} ${product.slug} ${(product as any).categories?.name ?? ''} ${product.status}`}
                      className={ROW}
                    >
                      <td className={TD}>
                        <div className="flex items-center gap-3">
                          {product.images[0] ? (
                            <img src={product.images[0]} alt="" className="h-10 w-10 rounded-lg border border-slate-100 object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-slate-100" />
                          )}
                          <div className="min-w-0">
                            <p className="line-clamp-1 font-medium text-slate-900">{product.name}</p>
                            <p className="text-xs text-slate-400">/{product.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`${TD} text-slate-500`}>{(product as any).categories?.name ?? '—'}</td>
                      <td className={`${TD} text-right font-medium tabular-nums`}>
                        {formatGHS(product.price)}
                        {product.commission_percent !== null && product.commission_percent !== undefined && (
                          <p className="mt-0.5 text-[11px] font-semibold text-amber-600">
                            Custom commission {product.commission_percent}%
                          </p>
                        )}
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>
                        <span className={product.stock_qty < 5 ? 'font-semibold text-red-600' : 'text-slate-600'}>{product.stock_qty}</span>
                      </td>
                      <td className={TD}>
                        <Badge tone={STATUS_TONE[product.status as keyof typeof STATUS_TONE] ?? 'gray'}>
                          {STATUS_LABEL[product.status] ?? product.status}
                        </Badge>
                      </td>
                      <td className={`${TD} text-right`}>
                        <div className="flex items-center justify-end gap-3">
                          <Link href={`/admin/products/${product.id}/edit`} className={LINK}>Edit</Link>
                          <DeleteProductButton id={product.id} name={product.name} />
                        </div>
                      </td>
                    </SearchItem>
                  ))}
                </tbody>
              </table>
            </SearchScope>
          </div>
        )}
      </Panel>
    </div>
  )
}
