export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import SupportSettingsForm from '@/components/admin/SupportSettingsForm'
import { getSupportSettings } from '@/lib/actions/support'

export const metadata: Metadata = { title: 'Support Details' }

export default async function AdminSupportPage() {
  const support = await getSupportSettings()

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Support Details</h1>
        <p className="text-sm text-slate-500 mt-1">
          Shown to customers in the storefront footer, on shop pages and on the order tracking page.
          Leave a field blank to hide that channel.
        </p>
      </div>
      <SupportSettingsForm initial={support} />
    </div>
  )
}
