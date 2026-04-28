export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import DeliveryFeeForm from '@/components/admin/DeliveryFeeForm'
import { GHANA_REGIONS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Delivery Fees' }

export default async function DeliveryFeesPage() {
  const admin = createAdminClient()
  const { data: fees } = await admin
    .from('delivery_fees')
    .select('region, fee, enabled')
    .order('region')

  // Build a map so missing regions default to 0/enabled
  const feeMap: Record<string, { fee: number; enabled: boolean }> = {}
  for (const f of fees ?? []) {
    feeMap[f.region] = { fee: f.fee, enabled: f.enabled }
  }

  const rows = GHANA_REGIONS.map((r) => ({
    region: r,
    fee: feeMap[r]?.fee ?? 0,
    enabled: feeMap[r]?.enabled ?? true,
  }))

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Delivery Fees</h1>
        <p className="text-sm text-gray-500 mt-1">
          Set the delivery fee per region. Disabled regions will not appear at checkout.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[400px]">
            <div className="grid grid-cols-[1fr_120px_80px_80px] text-xs font-semibold uppercase tracking-wider text-gray-400 px-5 py-3 bg-gray-50 border-b border-gray-100">
              <span>Region</span>
              <span>Fee (GHS)</span>
              <span className="text-center">Enabled</span>
              <span></span>
            </div>
            <div className="divide-y divide-gray-50">
              {rows.map((row) => (
                <DeliveryFeeForm key={row.region} {...row} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
