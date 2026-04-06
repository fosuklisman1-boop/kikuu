export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'
import type { Metadata } from 'next'
import Link from 'next/link'
import UserActionsMenu from '@/components/admin/UserActionsMenu'

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
    admin.from('orders').select('buyer_id, total, status'),
  ])

  const users = usersData?.users ?? []

  // Build per-user order stats
  const ordersByUser: Record<string, { count: number; spent: number }> = {}
  for (const o of orders ?? []) {
    if (!o.buyer_id) continue
    if (!ordersByUser[o.buyer_id]) ordersByUser[o.buyer_id] = { count: 0, spent: 0 }
    ordersByUser[o.buyer_id].count++
    if (['paid', 'processing', 'shipped', 'delivered'].includes(o.status)) {
      ordersByUser[o.buyer_id].spent += o.total
    }
  }

  const banned = users.filter((u) => isBanned(u.banned_until))
  const confirmed = users.filter((u) => u.email_confirmed_at)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} registered customer{users.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Users', value: users.length, color: 'bg-blue-500' },
          { label: 'Verified Email', value: confirmed.length, color: 'bg-green-500' },
          { label: 'Banned', value: banned.length, color: 'bg-red-500' },
          { label: 'With Orders', value: Object.keys(ordersByUser).length, color: 'bg-purple-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className={`w-3 h-3 rounded-full ${s.color} mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">All Customers</h2>
        </div>

        {users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
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
              <tbody className="divide-y divide-gray-50">
                {users.map((user) => {
                  const meta = user.user_metadata as Record<string, string> | null
                  const name = meta?.full_name ?? ''
                  const phone = meta?.phone ?? '—'
                  const stats = ordersByUser[user.id] ?? { count: 0, spent: 0 }
                  const banned = isBanned(user.banned_until)

                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      {/* Customer */}
                      <td className="px-4 py-3">
                        <Link href={`/admin/users/${user.id}`} className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-xs font-extrabold shrink-0">
                            {initials(name, user.email ?? '?')}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 group-hover:text-green-600 transition-colors truncate max-w-[160px]">
                              {name || <span className="text-gray-400 italic">No name</span>}
                            </p>
                            <p className="text-xs text-gray-400 truncate max-w-[160px]">{user.email}</p>
                          </div>
                        </Link>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 text-gray-600">{phone}</td>

                      {/* Joined */}
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(user.created_at).toLocaleDateString('en-GH', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>

                      {/* Last login */}
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {user.last_sign_in_at
                          ? new Date(user.last_sign_in_at).toLocaleDateString('en-GH', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Orders */}
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-gray-900">{stats.count}</span>
                      </td>

                      {/* Spent */}
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {stats.spent > 0 ? formatGHS(stats.spent) : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        {banned ? (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600 border border-red-200">
                            Banned
                          </span>
                        ) : user.email_confirmed_at ? (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">
                            Unverified
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <UserActionsMenu userId={user.id} isBanned={banned} userName={name || user.email || user.id} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-gray-400">
            <div className="text-4xl mb-3">👥</div>
            <p className="font-medium">No users yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
