'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createPromoCard, updatePromoCard } from '@/lib/actions/promo-cards'
import type { PromoCardWithCoupon } from '@/lib/supabase/types'

// Active coupons passed down from the server page
export interface CouponOption {
  id: string
  code: string
  type: string
  value: number
}

const THEMES = [
  { value: 'amber',  label: 'Amber',  bg: '#b45309' },
  { value: 'green',  label: 'Green',  bg: '#15803d' },
  { value: 'blue',   label: 'Blue',   bg: '#1d4ed8' },
  { value: 'purple', label: 'Purple', bg: '#7c3aed' },
  { value: 'red',    label: 'Red',    bg: '#be123c' },
] as const

type Theme = typeof THEMES[number]['value']

function couponLabel(c: CouponOption) {
  if (c.type === 'free_shipping') return `${c.code} — Free Shipping`
  if (c.type === 'percentage') return `${c.code} — ${c.value}% off`
  return `${c.code} — GHS ${c.value} off`
}

export default function PromoCardForm({
  initial,
  coupons,
  onCancel,
  onSaved,
}: {
  initial: PromoCardWithCoupon | null
  coupons: CouponOption[]
  onCancel: () => void
  onSaved: (card: PromoCardWithCoupon) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    heading: initial?.heading ?? '',
    subtext: initial?.subtext ?? '',
    badge_text: initial?.badge_text ?? '',
    cta_text: initial?.cta_text ?? '',
    cta_link: initial?.cta_link ?? '',
    color_theme: (initial?.color_theme ?? 'amber') as Theme,
    coupon_id: initial?.coupon_id ?? '',
    sort_order: String(initial?.sort_order ?? 0),
    active: initial?.active ?? true,
  })

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const payload = {
      heading: form.heading,
      subtext: form.subtext || null,
      badge_text: form.badge_text || null,
      cta_text: form.cta_text || null,
      cta_link: form.cta_link || null,
      color_theme: form.color_theme,
      coupon_id: form.coupon_id || null,
      sort_order: parseInt(form.sort_order) || 0,
      active: form.active,
    }

    const result = initial
      ? await updatePromoCard(initial.id, payload)
      : await createPromoCard(payload)

    setSaving(false)

    if (result.error) { setError(result.error); return }

    if (initial) {
      const linkedCoupon = coupons.find((c) => c.id === form.coupon_id) ?? null
      onSaved({
        ...initial,
        ...payload,
        coupons: linkedCoupon
          ? { code: linkedCoupon.code, type: linkedCoupon.type as 'percentage' | 'fixed' | 'free_shipping', value: linkedCoupon.value }
          : null,
      })
    } else if ('data' in result && result.data) {
      onSaved(result.data as PromoCardWithCoupon)
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100'
  const labelCls = 'block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{initial ? 'Edit Promo Card' : 'New Promo Card'}</h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div>
        <label className={labelCls}>Heading *</label>
        <input
          value={form.heading}
          onChange={(e) => set('heading', e.target.value)}
          required
          placeholder="Free Delivery in Accra"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Body Text</label>
        <textarea
          value={form.subtext}
          onChange={(e) => set('subtext', e.target.value)}
          rows={2}
          placeholder="On all orders over GHS 200."
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Badge Label</label>
          <input
            value={form.badge_text}
            onChange={(e) => set('badge_text', e.target.value)}
            placeholder="Limited Time Offer"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Coupon</label>
          <select
            value={form.coupon_id}
            onChange={(e) => set('coupon_id', e.target.value)}
            className={inputCls}
          >
            <option value="">— None —</option>
            {coupons.map((c) => (
              <option key={c.id} value={c.id}>{couponLabel(c)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Button Text</label>
          <input
            value={form.cta_text}
            onChange={(e) => set('cta_text', e.target.value)}
            placeholder="Shop Now"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Button Link</label>
          <input
            value={form.cta_link}
            onChange={(e) => set('cta_link', e.target.value)}
            placeholder="/products"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Color Theme</label>
        <div className="flex gap-3 mt-1">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => set('color_theme', t.value)}
              title={t.label}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                form.color_theme === t.value ? 'border-gray-900 scale-110' : 'border-transparent'
              }`}
              style={{ background: t.bg }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 items-center">
        <div>
          <label className={labelCls}>Sort Order</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => set('sort_order', e.target.value)}
            min="0"
            className={inputCls}
          />
        </div>
        <div className="flex items-center gap-2 pt-4">
          <button
            type="button"
            onClick={() => set('active', !form.active)}
            className={`w-11 h-6 rounded-full transition-colors relative ${form.active ? 'bg-green-500' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.active ? 'left-6' : 'left-1'}`} />
          </button>
          <span className="text-sm text-gray-700">Active</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Card'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
