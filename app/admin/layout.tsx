import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: { template: '%s | Admin', default: 'Admin' } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/account/login?redirect=/admin')

  // Use admin client to bypass RLS — ensures the role check always works
  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user!.id).single()
  if (profile?.role !== 'admin') redirect('/')

  // Paid orders waiting to ship, shown as a badge on the Orders link.
  const { count: toShip } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('payment_status', 'paid')
    .eq('delivery_status', 'processing')

  return (
    <div className="flex h-screen bg-[#f4f6f3]">
      <AdminSidebar toShip={toShip ?? 0} />
      <main className="flex-1 min-w-0 overflow-auto px-4 pb-8 pt-20 lg:px-8">{children}</main>
    </div>
  )
}
