'use client'

import { useCart } from '@/lib/cart'
import { formatGHS, GHANA_REGIONS, SHIPPING_FEES, isValidGhanaPhone } from '@/lib/utils'
import { validateCoupon } from '@/lib/actions/coupons'
import { getCurrentPrices } from '@/lib/actions/prices'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { SavedAddress } from '@/lib/supabase/types'
import { MapPin, User as UserIcon, Zap, LogIn, Tag, X, CreditCard, Banknote, CalendarClock } from 'lucide-react'
import Link from 'next/link'
import Script from 'next/script'

export default function CheckoutForm() {
  const { items, total, clearCart, hasPreorderItems, latestPreorderDate, _hasHydrated } = useCart()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [coupon, setCoupon] = useState('')
  const [couponApplied, setCouponApplied] = useState('')
  const [discount, setDiscount] = useState(0)
  const [isFreeShipping, setIsFreeShipping] = useState(false)
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [paymentType, setPaymentType] = useState<'paystack' | 'cod'>('paystack')
  const [deliveryFees, setDeliveryFees] = useState<Record<string, number> | null>(null)
  const [livePrices, setLivePrices] = useState<Record<string, number> | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [selectedSavedId, setSelectedSavedId] = useState<string>('')

  const [form, setForm] = useState({
    email: '',
    recipient_name: '',
    phone: '',
    region: '',
    district: '',
    city: '',
    landmark: '',
    digital_address: '',
  })

  // Refresh prices from server (applies active flash sales) once cart is hydrated
  useEffect(() => {
    if (!_hasHydrated || !items.length) return
    getCurrentPrices(items.map((i) => i.product_id ?? i.id)).then(setLivePrices)
  }, [_hasHydrated, items.length])

  // Load delivery fees from DB, fall back to hardcoded if table missing/empty
  useEffect(() => {
    const supabase = createClient()
    supabase.from('delivery_fees').select('region, fee, enabled').then(({ data, error }) => {
      const map: Record<string, number> = {}
      if (!error && data && data.length > 0) {
        for (const row of data) {
          if (row.enabled) map[row.region] = Number(row.fee)
        }
      } else {
        // Fallback to hardcoded fees
        Object.assign(map, SHIPPING_FEES)
      }
      setDeliveryFees(map)
    })
  }, [])

  // Load user + saved addresses on mount
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) return
      setUser(u)
      const meta = u.user_metadata as Record<string, string> | null
      const addrs: SavedAddress[] = meta?.addresses ? JSON.parse(meta.addresses) : []
      setSavedAddresses(addrs)
      // Pre-fill email and name/phone from profile
      setForm((f) => ({
        ...f,
        email: u.email ?? f.email,
        recipient_name: meta?.full_name ?? f.recipient_name,
        phone: meta?.phone ?? f.phone,
      }))
      // Auto-select default address
      const def = addrs.find((a) => a.is_default)
      if (def) applyAddress(def)
    })
  }, [])

  function applyAddress(addr: SavedAddress) {
    setForm((f) => ({
      ...f,
      recipient_name: addr.recipient_name,
      phone: addr.phone,
      region: addr.region,
      district: addr.district,
      city: addr.city,
      landmark: addr.landmark ?? '',
      digital_address: addr.digital_address ?? '',
    }))
    setSelectedSavedId(addr.id)
  }

  // Pre-order carts are forced to COD
  const effectivePaymentType = hasPreorderItems ? 'cod' : paymentType

  // Use live (server-authoritative) prices when loaded — reflects active flash sales
  const liveSubtotal = livePrices
    ? items.reduce((sum, i) => sum + (livePrices[i.product_id ?? i.id] ?? i.price) * i.quantity, 0)
    : total

  const feesLoaded = deliveryFees !== null
  const shippingFee = (feesLoaded && form.region) ? (deliveryFees![form.region] ?? 0) : null
  // Free shipping coupons waive the delivery fee; regular coupons use the fixed discount amount
  const effectiveDiscount = isFreeShipping ? (shippingFee ?? 0) : discount
  const grandTotal = shippingFee !== null ? liveSubtotal + shippingFee - effectiveDiscount : null

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    if (selectedSavedId) setSelectedSavedId('')
  }

  async function handleApplyCoupon() {
    if (!coupon.trim()) return
    setCouponLoading(true)
    setCouponError('')
    const result = await validateCoupon(coupon, total)
    setCouponLoading(false)
    if (result.error) {
      setCouponError(result.error)
      setDiscount(0)
      setIsFreeShipping(false)
      setCouponApplied('')
    } else {
      setDiscount(result.discount)
      setIsFreeShipping(result.freeShipping ?? false)
      setCouponApplied(coupon.toUpperCase().trim())
    }
  }

  function removeCoupon() {
    setCoupon('')
    setCouponApplied('')
    setDiscount(0)
    setIsFreeShipping(false)
    setCouponError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!items.length) return
    setError('')
    setPhoneError('')
    if (!isValidGhanaPhone(form.phone)) {
      setPhoneError('Enter a valid Ghana phone number (e.g. 024 123 4567).')
      return
    }
    setLoading(true)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          address: {
            recipient_name: form.recipient_name,
            phone: form.phone,
            region: form.region,
            district: form.district,
            city: form.city,
            landmark: form.landmark,
            digital_address: form.digital_address || undefined,
          },
          coupon_code: couponApplied || undefined,
          payment_type: effectivePaymentType,
          items: items.map((i) => ({
            product_id: i.product_id ?? i.id,
            quantity: i.quantity,
            selected_color: i.selected_color,
            selected_size: i.selected_size,
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message ?? data.error ?? 'Checkout failed. Please try again.')
        setLoading(false)
        return
      }

      if (effectivePaymentType === 'cod') {
        clearCart()
        router.push(`/orders/${data.order_id}?cod=1`)
        return
      }

      // If server-computed total differs from what we showed (e.g. flash sale applied),
      // warn the user so there's no surprise when the Paystack modal opens.
      if (typeof data.total === 'number' && grandTotal !== null && Math.abs(data.total - grandTotal) > 0.01) {
        const proceed = window.confirm(
          `The order total has been updated to ${formatGHS(data.total)} (was ${formatGHS(grandTotal)}) due to a price change. Continue with payment?`
        )
        if (!proceed) {
          setLoading(false)
          return
        }
      }

      // Paystack Popup v2 — no form-element requirement
      const PaystackPop = (window as any).PaystackPop
      if (!PaystackPop) {
        setError('Payment provider failed to load. Please refresh and try again.')
        setLoading(false)
        return
      }

      new PaystackPop().newTransaction({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY as string,
        accessCode: data.access_code,
        onSuccess: async (transaction: { reference: string }) => {
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order_id: data.order_id, reference: transaction.reference }),
            })
            const verifyData = await verifyRes.json()
            if (verifyRes.ok) {
              clearCart()
              router.push(`/orders/${data.order_id}?success=1`)
            } else {
              setError(verifyData.error ?? 'Payment verification failed. Please contact support.')
              setLoading(false)
            }
          } catch {
            setError('Network error during verification. Please contact support.')
            setLoading(false)
          }
        },
        onCancel: () => {
          setLoading(false)
        },
      })
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }



  if (_hasHydrated && items.length === 0) {
    router.replace('/cart')
    return null
  }

  if (!_hasHydrated) {
    return (
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-4" />
              <div className="h-10 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 h-fit animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-1/2 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
          </div>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#b45309] focus:ring-2 focus:ring-[#b45309]/10 transition-all'

  return (
    <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
      <Script src="https://js.paystack.co/v2/inline.js" strategy="afterInteractive" />
      {/* Left: delivery form */}
      <div className="lg:col-span-2 space-y-5">

        {/* Logged-in banner / sign-in nudge */}
        {user ? (
          <div className="flex items-center gap-3 bg-[#fdf6ec] border border-[#b45309]/20 rounded-2xl px-4 py-3">
            <div className="w-8 h-8 rounded-xl bg-[#b45309] flex items-center justify-center shrink-0">
              <Zap size={15} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#92400e]">Checking out as {user.email}</p>
              <p className="text-xs text-[#b45309]">Your order will be saved to your account.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <LogIn size={16} className="text-blue-500 shrink-0" />
              <p className="text-sm text-blue-700">
                <span className="font-semibold">Sign in</span> for faster checkout with saved addresses
              </p>
            </div>
            <Link href="/account/login?redirect=/checkout" className="shrink-0 text-xs font-bold text-blue-600 bg-white border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-xl transition-all">
              Sign In
            </Link>
          </div>
        )}

        {/* Saved address picker */}
        {savedAddresses.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={16} className="text-[#b45309]" />
              <h2 className="font-semibold text-gray-900 text-sm">Deliver to a saved address</h2>
            </div>
            <div className="grid gap-2">
              {savedAddresses.map((addr) => (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => applyAddress(addr)}
                  className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-all ${
                    selectedSavedId === addr.id
                      ? 'border-[#b45309] bg-[#fdf6ec] ring-2 ring-[#b45309]/10'
                      : 'border-gray-200 hover:border-[#b45309]/30 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{addr.recipient_name}</p>
                      <p className="text-xs text-gray-500">{addr.city}, {addr.district}, {addr.region}</p>
                      <p className="text-xs text-gray-400">{addr.phone}</p>
                    </div>
                    {addr.is_default && (
                      <span className="text-[10px] font-bold text-[#b45309] bg-[#fdf6ec] px-2 py-0.5 rounded-full">Default</span>
                    )}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setSelectedSavedId(''); setForm((f) => ({ ...f, region: '', district: '', city: '', landmark: '', digital_address: '' })) }}
                className="text-xs text-gray-500 hover:text-[#b45309] text-left px-1 transition-colors"
              >
                + Enter a different address
              </button>
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserIcon size={16} className="text-gray-400" />
            <h2 className="font-semibold text-gray-900">Contact Information</h2>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="you@example.com"
              className={inputCls}
            />
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-gray-400" />
            <h2 className="font-semibold text-gray-900">Delivery Address</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Full Name</label>
              <input type="text" name="recipient_name" value={form.recipient_name} onChange={handleChange} required placeholder="Kwame Mensah" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={(e) => { handleChange(e); setPhoneError('') }}
                required
                placeholder="024 000 0000"
                className={`${inputCls} ${phoneError ? 'border-red-400 focus:border-red-400' : ''}`}
              />
              {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Region</label>
              <select name="region" value={form.region} onChange={handleChange} required className={inputCls}>
                <option value="">Select Region</option>
                {GHANA_REGIONS.filter((r) => !deliveryFees || deliveryFees[r] !== undefined).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">District</label>
              <input type="text" name="district" value={form.district} onChange={handleChange} required placeholder="e.g. Accra Metropolitan" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">City / Town</label>
              <input type="text" name="city" value={form.city} onChange={handleChange} required placeholder="e.g. Osu" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Landmark / Street</label>
              <input type="text" name="landmark" value={form.landmark} onChange={handleChange} required placeholder="e.g. Near Shell Filling Station" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                GhanaPostGPS <span className="font-normal text-gray-400 normal-case">(optional)</span>
              </label>
              <input type="text" name="digital_address" value={form.digital_address} onChange={handleChange} placeholder="e.g. GA-144-0000" className={inputCls} />
            </div>
          </div>
        </div>
      </div>

      {/* Right: order summary */}
      <div className="space-y-4">

        {/* Pre-order COD notice */}
        {hasPreorderItems && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
            <div className="flex items-start gap-2.5">
              <CalendarClock size={16} className="text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-800">Pre-order item in cart</p>
                <p className="text-xs text-orange-600 mt-0.5">
                  Payment is collected on delivery.
                  {latestPreorderDate && ` Expected ship date: ${new Date(latestPreorderDate).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Payment method selector — hidden for pre-order carts */}
        {!hasPreorderItems && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-bold text-gray-900 mb-3">Payment Method</h2>
            <div className="space-y-2">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                paymentType === 'paystack' ? 'border-[#b45309] bg-[#fdf6ec]' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="payment_type"
                  value="paystack"
                  checked={paymentType === 'paystack'}
                  onChange={() => setPaymentType('paystack')}
                  className="mt-0.5 accent-[#b45309]"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <CreditCard size={14} className="text-[#b45309]" />
                    <span className="text-sm font-semibold text-gray-900">Pay Online</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">MTN MoMo, Vodafone Cash, Card, Bank Transfer</p>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                paymentType === 'cod' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="payment_type"
                  value="cod"
                  checked={paymentType === 'cod'}
                  onChange={() => setPaymentType('cod')}
                  className="mt-0.5 accent-purple-600"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <Banknote size={14} className="text-purple-600" />
                    <span className="text-sm font-semibold text-gray-900">Pay on Delivery</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Pay cash when your order arrives</p>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 mb-4">Order Summary</h2>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto mb-4">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3 py-2.5">
                {item.image && (
                  <img src={item.image} alt={item.name} className="w-11 h-11 object-cover rounded-lg shrink-0" />
                )}
                <div className="flex-1 min-w-0 text-sm">
                  <p className="text-gray-800 line-clamp-1 font-medium">{item.name}</p>
                  <p className="text-gray-400 text-xs">×{item.quantity}</p>
                </div>
                <p className="text-sm font-semibold shrink-0">{formatGHS((livePrices?.[item.product_id ?? item.id] ?? item.price) * item.quantity)}</p>
              </div>
            ))}
          </div>

          {/* Coupon */}
          <div className="mb-4">
            {couponApplied ? (
              <div className="flex items-center justify-between bg-[#fdf6ec] border border-[#b45309]/20 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-[#b45309]">
                  <Tag size={13} />
                  <span className="font-bold">{couponApplied}</span>
                  <span>— {isFreeShipping ? 'Free delivery!' : `${formatGHS(discount)} off`}</span>
                </div>
                <button type="button" onClick={removeCoupon} className="text-[#b45309]/60 hover:text-[#b45309]">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={coupon}
                    onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setCouponError('') }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApplyCoupon())}
                    placeholder="Coupon code"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#b45309] transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !coupon.trim()}
                    className="text-xs font-bold text-[#b45309] bg-[#fdf6ec] hover:bg-[#faecd8] px-3 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {couponLoading ? '...' : 'Apply'}
                  </button>
                </div>
                {couponError && <p className="text-xs text-red-500">{couponError}</p>}
              </div>
            )}
          </div>

          <div className="space-y-2 text-sm text-gray-600 border-t border-gray-50 pt-3">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatGHS(liveSubtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery{form.region ? ` (${form.region})` : ''}</span>
              <span className="text-gray-400">
                {!form.region
                  ? 'Select region'
                  : shippingFee === null
                  ? '...'
                  : formatGHS(shippingFee)}
              </span>
            </div>
            {(discount > 0 || isFreeShipping) && (
              <div className="flex justify-between text-[#b45309]">
                <span>{isFreeShipping ? 'Free Delivery' : `Discount (${couponApplied})`}</span>
                <span>
                  {isFreeShipping
                    ? shippingFee !== null ? `−${formatGHS(shippingFee)}` : '−GHS 0.00'
                    : `−${formatGHS(discount)}`}
                </span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-gray-900 border-t border-gray-100 pt-2 text-base">
              <span>Total</span>
              <span>
                {grandTotal !== null ? formatGHS(grandTotal) : formatGHS(total - discount)}
                {shippingFee === null && <span className="text-xs font-normal text-gray-400 ml-1">+ delivery</span>}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full font-extrabold py-4 rounded-2xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-lg shadow-lg text-white ${
            effectivePaymentType === 'cod'
              ? 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700 shadow-purple-500/25'
              : 'bg-[#b45309] hover:bg-[#92400e] active:bg-[#78350f] shadow-[#b45309]/25'
          }`}
        >
          {loading
            ? 'Processing...'
            : grandTotal === null
            ? 'Select delivery region'
            : effectivePaymentType === 'cod'
            ? `Place Order — Pay ${formatGHS(grandTotal)} on Delivery`
            : `Pay ${formatGHS(grandTotal)}`}
        </button>

        <p className="text-xs text-center text-gray-400">
          {effectivePaymentType === 'cod'
            ? 'Pay cash when your order is delivered to your door.'
            : 'Secure checkout by Paystack. Pay with MTN MoMo, Vodafone Cash, Card, or Bank Transfer.'}
        </p>
      </div>
    </form>
  )
}
