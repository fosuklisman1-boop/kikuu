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

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
