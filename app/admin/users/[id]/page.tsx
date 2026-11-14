export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { OrderItem, GhanaAddress } from '@/lib/supabase/types'
import Link from 'next/link'
import UserBanButton from '@/components/admin/UserBanButton'
import UserRoleButton from '@/components/admin/UserRoleButton'
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Clock, Package, ShoppingBag } from 'lucide-react'

export const metadata: Metadata = { title: 'User Detail' }

function isBanned(bannedUntil?: string | null) {
  if (!bannedUntil) return false
  return new Date(bannedUntil) > new Date()
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-slate-100 text-slate-500',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params
  const admin = createAdminClient()

  const [{ data: userData }, { data: orders }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(id),
    admin.from('orders')
      .select('id, order_number, total, status, payment_status, created_at, items, shipping_address')
      .eq('buyer_id', id)
      .order('created_at', { ascending: false }),
    admin.from('users').select('role').eq('id', id).single(),
  ])

  if (!userData?.user) notFound()

  const user = userData.user
  const meta = user.user_metadata as Record<string, string> | null
  const name = meta?.full_name ?? ''
  const phone = meta?.phone ?? ''
  const addresses: GhanaAddress[] = meta?.addresses ? JSON.parse(meta.addresses) : []
  const banned = isBanned(user.banned_until)
  const role: 'admin' | 'customer' = profile?.role === 'admin' ? 'admin' : 'customer'

  const totalSpent = (orders ?? [])
    .filter((o) => o.payment_status === 'paid')
    .reduce((sum, o) => sum + o.total, 0)

  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : (user.email?.[0] ?? '?').toUpperCase()

  return (
    <div className="max-w-4xl">
      {/* Back */}
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to Users
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl font-extrabold shrink-0">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{name || 'No name set'}</h1>
                {banned ? (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">Banned</span>
                ) : user.email_confirmed_at ? (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Active</span>
                ) : (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">Unverified</span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Mail size={13} />{user.email}</span>
                {phone && <span className="flex items-center gap-1.5"><Phone size={13} />{phone}</span>}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 items-end">
            <UserRoleButton userId={user.id} currentRole={role} />
            <UserBanButton userId={user.id} isBanned={banned} userName={name || user.email || user.id} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="space-y-5">
          {/* Account info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4 text-sm text-slate-500">Account Info</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5 text-slate-600">
                <Calendar size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">Joined</p>
                  <p>{new Date(user.created_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-slate-600">
                <Clock size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">Last Login</p>
                  <p>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Never'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-slate-600">
                <Mail size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">Email Verified</p>
                  <p>{user.email_confirmed_at ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Order stats */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-sm text-slate-500 mb-4">Order Stats</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="flex justify-center mb-1"><Package size={16} className="text-slate-400" /></div>
                <p className="text-xl font-extrabold text-slate-900">{orders?.length ?? 0}</p>
                <p className="text-xs text-slate-400">Orders</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <div className="flex justify-center mb-1"><ShoppingBag size={16} className="text-emerald-500" /></div>
                <p className="text-xl font-extrabold text-slate-900 text-sm leading-tight">{formatGHS(totalSpent)}</p>
                <p className="text-xs text-slate-400">Total Spent</p>
              </div>
            </div>
          </div>

          {/* Saved addresses */}
          {addresses.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-sm text-slate-500 mb-4">
                Saved Addresses ({addresses.length})
              </h2>
              <div className="space-y-3">
                {addresses.map((addr, i) => (
                  <div key={i} className="text-sm bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MapPin size={12} className="text-slate-400" />
                      <span className="font-medium text-slate-700">{addr.recipient_name}</span>
                    </div>
                    <p className="text-xs text-slate-500">{addr.city}, {addr.district}</p>
                    <p className="text-xs text-slate-500">{addr.region}</p>
                    <p className="text-xs text-slate-400">{addr.phone}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Order history */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <h2 className="font-bold text-slate-900">Order History</h2>
            </div>

            {orders && orders.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {orders.map((order) => {
                  const items = order.items as OrderItem[]
                  const firstItem = items?.[0]
                  return (
                    <Link
                      key={order.id}
                      href={`/admin/orders/${order.id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        {firstItem?.product_image
                          ? <img src={firstItem.product_image} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-slate-300" /></div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{order.order_number}</p>
                        <p className="text-xs text-slate-400">
                          {items?.length ?? 0} item{items?.length !== 1 ? 's' : ''} · {new Date(order.created_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-slate-900 text-sm">{formatGHS(order.total)}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-slate-100 text-slate-500'}`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <Package size={32} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm">No orders placed yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
