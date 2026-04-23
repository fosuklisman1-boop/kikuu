'use client'

import { useState } from 'react'
import { createAnnouncement, updateAnnouncement, deleteAnnouncement } from '@/lib/actions/announcements'
import { createBanner, updateBanner, deleteBanner } from '@/lib/actions/banners'
import { deletePromoCard, togglePromoCard } from '@/lib/actions/promo-cards'
import { Plus, Trash2, Save, X } from 'lucide-react'
import type { Banner, PromoCardWithCoupon } from '@/lib/supabase/types'
import PromoCardForm, { type CouponOption } from '@/components/admin/PromoCardForm'

interface Message {
  id: string
  message: string
  active: boolean
  sort_order: number
}

export default function BannerManager({
  initialMessages,
  initialBanners,
  initialPromoCards,
  coupons,
}: {
  initialMessages: Message[]
  initialBanners: Banner[]
  initialPromoCards: PromoCardWithCoupon[]
  coupons: CouponOption[]
}) {
  const [tab, setTab] = useState<'announcements' | 'carousel' | 'promo'>('announcements')

  // ── Announcements state ──────────────────────────────────────
  const [messages, setMessages] = useState(initialMessages)
  const [newText, setNewText] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  async function handleAdd() {
    if (!newText.trim()) return
    setAdding(true)
    const result = await createAnnouncement(newText)
    setAdding(false)
    if (!result.error) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), message: newText.trim(), active: true, sort_order: prev.length },
      ])
      setNewText('')
    }
  }

  async function handleSave(msg: Message) {
    setSaving(msg.id)
    await updateAnnouncement(msg.id, msg.message, msg.active)
    setSaving(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this message?')) return
    await deleteAnnouncement(id)
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  function update(id: string, patch: Partial<Message>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  // ── Carousel state ───────────────────────────────────────────
  const [banners, setBanners] = useState<Banner[]>(initialBanners)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [showBannerForm, setShowBannerForm] = useState(false)

  function closeBannerForm() {
    setShowBannerForm(false)
    setEditingBanner(null)
  }

  // ── Promo cards state ─────────────────────────────────────────
  const [promoCards, setPromoCards] = useState<PromoCardWithCoupon[]>(initialPromoCards)
  const [editingPromo, setEditingPromo] = useState<PromoCardWithCoupon | null>(null)
  const [showPromoForm, setShowPromoForm] = useState(false)

  function closePromoForm() {
    setShowPromoForm(false)
    setEditingPromo(null)
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div>
      {/* Tab switcher */}
      <div className="flex border-b border-gray-200 mb-6">
        {(['announcements', 'carousel', 'promo'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'announcements' ? 'Announcement Bar' : t === 'carousel' ? 'Hero Carousel' : 'Promo Cards'}
          </button>
        ))}
      </div>

      {/* ── Announcements tab ── */}
      {tab === 'announcements' && (
        <div className="space-y-4">
          {/* Preview */}
          <div className="bg-gray-900 text-white rounded-xl overflow-hidden h-9 flex items-center px-4">
            <p className="text-xs text-gray-300 truncate">
              Preview: {messages.filter((m) => m.active).map((m) => m.message).join('  •  ') || 'No active messages'}
            </p>
          </div>

          {/* Messages list */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {messages.length === 0 && (
              <p className="text-center py-8 text-sm text-gray-400">No messages yet. Add one below.</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="p-4 flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => update(msg.id, { active: !msg.active })}
                  className={`mt-0.5 w-9 h-5 rounded-full shrink-0 transition-colors relative ${msg.active ? 'bg-green-500' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${msg.active ? 'left-4' : 'left-0.5'}`} />
                </button>
                <input
                  type="text"
                  value={msg.message}
                  onChange={(e) => update(msg.id, { message: e.target.value })}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-500"
                />
                <button
                  onClick={() => handleSave(msg)}
                  disabled={saving === msg.id}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                  title="Save"
                >
                  <Save size={15} />
                </button>
                <button
                  onClick={() => handleDelete(msg.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Add new */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Add a new announcement message..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newText.trim()}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 rounded-xl transition-colors disabled:opacity-50"
            >
              <Plus size={15} />
              Add
            </button>
          </div>
        </div>
      )}

      {/* ── Carousel tab ── */}
      {tab === 'carousel' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {banners.length} slide{banners.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => { setEditingBanner(null); setShowBannerForm(true) }}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <Plus size={15} /> Add Slide
            </button>
          </div>

          {showBannerForm && (
            <BannerSlideForm
              initial={editingBanner}
              onCancel={closeBannerForm}
              onSaved={(saved) => {
                setBanners((prev) =>
                  editingBanner
                    ? prev.map((b) => (b.id === saved.id ? saved : b))
                    : [...prev, saved]
                )
                closeBannerForm()
              }}
            />
          )}

          {banners.length === 0 && !showBannerForm && (
            <div className="text-center py-12 text-gray-400 text-sm">
              No slides yet. Add one above.
            </div>
          )}

          {banners.map((b) => (
            <div key={b.id} className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              {b.image_url && (
                <img
                  src={b.image_url}
                  alt={b.title}
                  className="w-20 h-12 object-cover rounded-lg shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{b.title}</p>
                {b.subtitle && <p className="text-gray-400 text-xs truncate">{b.subtitle}</p>}
                <p className="text-xs mt-1">
                  <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${b.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {b.active ? 'Active' : 'Hidden'}
                  </span>
                  <span className="text-gray-400 ml-2">Order: {b.sort_order}</span>
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                <button
                  onClick={() => { setEditingBanner(b); setShowBannerForm(true) }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('Delete this slide?')) return
                    const result = await deleteBanner(b.id)
                    if (!result.error) setBanners((prev) => prev.filter((x) => x.id !== b.id))
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Promo Cards tab ── */}
      {tab === 'promo' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {promoCards.length} card{promoCards.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => { setEditingPromo(null); setShowPromoForm(true) }}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <Plus size={15} /> Add Card
            </button>
          </div>

          {showPromoForm && (
            <PromoCardForm
              initial={editingPromo}
              coupons={coupons}
              onCancel={closePromoForm}
              onSaved={(saved) => {
                setPromoCards((prev) =>
                  editingPromo
                    ? prev.map((c) => (c.id === saved.id ? saved : c))
                    : [...prev, saved]
                )
                closePromoForm()
              }}
            />
          )}

          {promoCards.length === 0 && !showPromoForm && (
            <div className="text-center py-12 text-gray-400 text-sm">
              No promo cards yet. Add one above.
            </div>
          )}

          {promoCards.map((card) => (
            <div key={card.id} className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div
                className="w-10 h-10 rounded-lg shrink-0"
                style={{
                  background: ({
                    amber: '#b45309', green: '#15803d', blue: '#1d4ed8',
                    purple: '#7c3aed', red: '#be123c',
                  } as Record<string, string>)[card.color_theme] ?? '#b45309',
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{card.heading}</p>
                <p className="text-gray-400 text-xs truncate">
                  {card.coupons ? `Coupon: ${card.coupons.code}` : 'No coupon linked'}
                  {' · '}Order: {card.sort_order}
                </p>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${card.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {card.active ? 'Active' : 'Hidden'}
                </span>
              </div>
              <div className="flex gap-3 shrink-0 items-center">
                <button
                  onClick={async () => {
                    const result = await togglePromoCard(card.id, !card.active)
                    if (!result.error) setPromoCards((prev) => prev.map((c) => c.id === card.id ? { ...c, active: !card.active } : c))
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
                >
                  {card.active ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => { setEditingPromo(card); setShowPromoForm(true) }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('Delete this promo card?')) return
                    const result = await deletePromoCard(card.id)
                    if (!result.error) setPromoCards((prev) => prev.filter((c) => c.id !== card.id))
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Inner form component ─────────────────────────────────────────────────────

function BannerSlideForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: Banner | null
  onCancel: () => void
  onSaved: (banner: Banner) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)

    // Normalise checkbox: hidden input provides 'false' baseline, checkbox overrides with 'true'
    fd.set('active', fd.get('active') === 'on' ? 'true' : 'false')

    if (initial) {
      const result = await updateBanner(initial.id, fd)
      setLoading(false)
      if (result.error) {
        setError(typeof result.error === 'string' ? result.error : JSON.stringify(result.error))
        return
      }
      // For update, reconstruct from fd — id is stable so no UUID mismatch risk
      const saved: Banner = {
        ...initial,
        title: fd.get('title') as string,
        subtitle: (fd.get('subtitle') as string) || null,
        image_url: fd.get('image_url') as string,
        cta_text: (fd.get('cta_text') as string) || null,
        cta_link: (fd.get('cta_link') as string) || null,
        sort_order: Number(fd.get('sort_order') ?? 0),
        active: fd.get('active') === 'true',
      }
      onSaved(saved)
    } else {
      const result = await createBanner(fd)
      setLoading(false)
      if (result.error) {
        setError(typeof result.error === 'string' ? result.error : JSON.stringify(result.error))
        return
      }
      // Use server-returned row to get the real Postgres id
      if (result.data) onSaved(result.data as Banner)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{initial ? 'Edit Slide' : 'New Slide'}</h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
          <input
            name="title"
            defaultValue={initial?.title}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Subtitle</label>
          <input
            name="subtitle"
            defaultValue={initial?.subtitle ?? ''}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Image URL *</label>
          <input
            name="image_url"
            defaultValue={initial?.image_url}
            required
            type="url"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">CTA Text</label>
          <input
            name="cta_text"
            defaultValue={initial?.cta_text ?? ''}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">CTA Link</label>
          <input
            name="cta_link"
            defaultValue={initial?.cta_link ?? ''}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sort Order</label>
          <input
            name="sort_order"
            type="number"
            defaultValue={initial?.sort_order ?? 0}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input
            name="active"
            type="checkbox"
            id="banner-active"
            defaultChecked={initial?.active ?? true}
            className="rounded"
          />
          <label htmlFor="banner-active" className="text-sm text-gray-700">Active</label>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save Slide'}
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
