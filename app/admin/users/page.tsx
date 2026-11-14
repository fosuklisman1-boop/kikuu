export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'
import type { Metadata } from 'next'
import Link from 'next/link'
import UserActionsMenu from '@/components/admin/UserActionsMenu'
import { SearchScope, SearchItem } from '@/components/ui/InstantSearch'
import { PageHeader, Panel, PanelTitle, Stat, Badge, EmptyState } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Users' }

function isBanned(bannedUntil?: string | null): boolean {
  if (!bannedUntil) return false
  return new Date(bannedUntil) > new Date()
}

function initials(name: string, email: string): string {
  if (name.trim()) {
    return name.trim().split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  }
  return email[0].toUpperCase()
}

export default async function AdminUsersPage() {
  const admin = createAdminClient()

  // Fetch all users (up to 1000) and orders in parallel
  const [{ data: usersData }, { data: orders }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from('orders').select('buyer_id, total, payment_status'),
  ])

  const users = usersData?.users ?? []

  // Build per-user order stats
  const ordersByUser: Record<string, { count: number; spent: number }> = {}
  for (const o of orders ?? []) {
    if (!o.buyer_id) continue
    if (!ordersByUser[o.buyer_id]) ordersByUser[o.buyer_id] = { count: 0, spent: 0 }
    ordersByUser[o.buyer_id].count++
    if (o.payment_status === 'paid') {
      ordersByUser[o.buyer_id].spent += o.total
    }
  }

  const banned = users.filter((u) => isBanned(u.banned_until))
  const confirmed = users.filter((u) => u.email_confirmed_at)

  return (
    <div>
      <PageHeader title="Customers" description={`${users.length} registered customer${users.length !== 1 ? 's' : ''}`} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total customers" value={users.length} />
        <Stat label="Verified email" value={confirmed.length} />
        <Stat label="Banned" value={banned.length} />
        <Stat label="With orders" value={Object.keys(ordersByUser).length} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">All Customers</h2>
        </div>

        {users.length > 0 ? (
          <div className="overflow-x-auto">
            <SearchScope placeholder="Search users by name, email, phone…" barClassName="mb-0 px-4 pt-3 pb-2">
<table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500 text-xs font-medium">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-left">Last Login</th>
                  <th className="px-4 py-3 text-center">Orders</th>
                  <th className="px-4 py-3 text-right">Spent</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const meta = user.user_metadata as Record<string, string> | null
                  const name = meta?.full_name ?? ''
                  const phone = meta?.phone ?? '—'
                  const stats = ordersByUser[user.id] ?? { count: 0, spent: 0 }
                  const banned = isBanned(user.banned_until)

                  return (
                    <SearchItem as="tr" key={user.id} text={`${user.email ?? ''} ${name} ${phone}`} className="hover:bg-slate-50 transition-colors">
                      {/* Customer */}
                      <td className="px-4 py-3">
                        <Link href={`/admin/users/${user.id}`} className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-semibold shrink-0">
                            {initials(name, user.email ?? '?')}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 group-hover:text-emerald-600 transition-colors truncate max-w-[160px]">
                              {name || <span className="text-slate-400 italic">No name</span>}
                            </p>
                            <p className="text-xs text-slate-400 truncate max-w-[160px]">{user.email}</p>
                          </div>
                        </Link>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 text-slate-600">{phone}</td>

                      {/* Joined */}
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(user.created_at).toLocaleDateString('en-GH', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>

                      {/* Last login */}
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {user.last_sign_in_at
                          ? new Date(user.last_sign_in_at).toLocaleDateString('en-GH', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Orders */}
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-slate-900">{stats.count}</span>
                      </td>

                      {/* Spent */}
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {stats.spent > 0 ? formatGHS(stats.spent) : <span className="text-slate-300">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        {banned ? (
                          <Badge tone="red">Banned</Badge>
                        ) : user.email_confirmed_at ? (
                          <Badge tone="green">Active</Badge>
                        ) : (
                          <Badge tone="amber">Unverified</Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <UserActionsMenu userId={user.id} isBanned={banned} userName={name || user.email || user.id} />
                      </td>
                    </SearchItem>
                  )
                })}
              </tbody>
            </table>
</SearchScope>
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400">
            <div className="text-4xl mb-3">👥</div>
            <p className="font-medium">No users yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
