'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCoupon, updateCoupon } from '@/lib/actions/coupons'

interface Coupon {
  id: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  min_order_amount: number | null
  max_uses: number | null
  expires_at: string | null
  active: boolean
}

export default function CouponForm({ coupon }: { coupon?: Coupon }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    code: coupon?.code ?? '',
    type: coupon?.type ?? 'percentage',
    value: String(coupon?.value ?? ''),
    min_order_amount: coupon?.min_order_amount != null ? String(coupon.min_order_amount) : '',
    max_uses: coupon?.max_uses != null ? String(coupon.max_uses) : '',
    expires_at: coupon?.expires_at ? coupon.expires_at.slice(0, 16) : '',
    active: coupon?.active ?? true,
  })

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const value = parseFloat(form.value)
    if (isNaN(value) || value <= 0) { setError('Value must be greater than 0'); return }
    if (form.type === 'percentage' && value > 100) { setError('Percentage cannot exceed 100'); return }

    setSaving(true)
    const data = {
      code: form.code,
      type: form.type as 'percentage' | 'fixed',
      value,
      min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      active: form.active,
    }

    const result = coupon
      ? await updateCoupon(coupon.id, data)
      : await createCoupon(data)

    setSaving(false)
    if (result.error) { setError(result.error); return }
    router.push('/admin/coupons')
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100'
  const labelCls = 'block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
      {error && (
        <p className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</p>
      )}

      <div>
        <label className={labelCls}>Coupon Code</label>
        <input
          type="text"
          value={form.code}
          onChange={(e) => set('code', e.target.value.toUpperCase())}
          required
          placeholder="e.g. ACCRA200"
          className={`${inputCls} font-mono`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Discount Type</label>
          <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputCls}>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount (GHS)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Value</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={form.type === 'percentage' ? 100 : undefined}
            value={form.value}
            onChange={(e) => set('value', e.target.value)}
            required
            placeholder={form.type === 'percentage' ? 'e.g. 10' : 'e.g. 20.00'}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Min Order Amount <span className="font-normal normal-case text-gray-400">(optional)</span></label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.min_order_amount}
            onChange={(e) => set('min_order_amount', e.target.value)}
            placeholder="e.g. 100"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Max Uses <span className="font-normal normal-case text-gray-400">(optional)</span></label>
          <input
            type="number"
            min="1"
            step="1"
            value={form.max_uses}
            onChange={(e) => set('max_uses', e.target.value)}
            placeholder="Unlimited"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Expires At <span className="font-normal normal-case text-gray-400">(optional)</span></label>
        <input
          type="datetime-local"
          value={form.expires_at}
          onChange={(e) => set('expires_at', e.target.value)}
          className={inputCls}
        />
      </div>

      <div className="flex items-center justify-between py-3 border-t border-gray-50">
        <div>
          <p className="text-sm font-semibold text-gray-700">Active</p>
          <p className="text-xs text-gray-400">Inactive coupons cannot be used at checkout</p>
        </div>
        <button
          type="button"
          onClick={() => set('active', !form.active)}
          className={`w-11 h-6 rounded-full transition-colors relative ${form.active ? 'bg-green-500' : 'bg-gray-200'}`}
        >
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.active ? 'left-6' : 'left-1'}`} />
        </button>
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-60 text-sm"
        >
          {saving ? 'Saving...' : coupon ? 'Save Changes' : 'Create Coupon'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/coupons')}
          className="px-4 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
