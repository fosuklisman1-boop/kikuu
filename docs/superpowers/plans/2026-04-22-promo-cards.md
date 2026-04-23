# Promo Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded homepage promo banner with admin-managed promo cards stored in Supabase — multiple cards, fully editable, each optionally linked to a coupon.

**Architecture:** New `promo_cards` Postgres table with RLS. Server actions for CRUD. The existing `/admin/banner` page gains a "Promo Cards" tab inside `BannerManager`. The homepage fetches active cards server-side and renders them in a responsive grid; if none exist the section is hidden.

**Tech Stack:** Next.js 15 App Router (server components), Supabase (admin client), React (client component admin form), Tailwind CSS, Zod validation, `next/cache` revalidation.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/011_promo_cards.sql` | Create | Table DDL, RLS, seed row |
| `lib/supabase/types.ts` | Modify | Add `PromoCard` type |
| `lib/actions/promo-cards.ts` | Create | Server actions: fetch, create, update, delete, toggle |
| `components/admin/PromoCardForm.tsx` | Create | Add/edit form (inline, same pattern as BannerSlideForm) |
| `components/admin/BannerManager.tsx` | Modify | Add "Promo Cards" tab and list |
| `app/admin/banner/page.tsx` | Modify | Fetch promo cards + active coupons, pass to BannerManager |
| `app/(store)/page.tsx` | Modify | Fetch + render promo cards, remove hardcoded block |

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/011_promo_cards.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/011_promo_cards.sql

create table public.promo_cards (
  id           uuid primary key default gen_random_uuid(),
  heading      text not null,
  subtext      text,
  badge_text   text,
  cta_text     text,
  cta_link     text,
  color_theme  text not null default 'amber'
               check (color_theme in ('amber', 'green', 'blue', 'purple', 'red')),
  coupon_id    uuid references public.coupons(id) on delete set null,
  sort_order   int not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.promo_cards enable row level security;

create policy "public_read_active_promo_cards" on public.promo_cards
  for select using (active = true);

create policy "admins_manage_promo_cards" on public.promo_cards
  for all using (public.is_admin()) with check (public.is_admin());

create index promo_cards_active_sort_idx on public.promo_cards (sort_order) where active = true;

-- Seed the card that was previously hardcoded on the homepage.
-- coupon_id is null — admin links it to ACCRA200 manually after that coupon is created.
insert into public.promo_cards (heading, subtext, badge_text, cta_text, cta_link, color_theme, sort_order)
values (
  'Free Delivery in Accra',
  'On all orders over GHS 200. Use the code below at checkout.',
  'Limited Time Offer',
  'Shop Now',
  '/products',
  'amber',
  0
);
```

- [ ] **Step 2: Apply the migration to your Supabase project**

Option A (Supabase CLI):
```bash
supabase db push
```

Option B (Supabase dashboard): paste the SQL into the SQL editor and run it.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/011_promo_cards.sql
git commit -m "feat: add promo_cards table with RLS and seed row"
```

---

## Task 2: TypeScript types

**Files:**
- Modify: `lib/supabase/types.ts`

- [ ] **Step 1: Add `promo_cards` to the Database interface**

In `lib/supabase/types.ts`, inside the `Tables` object (after the `banners` entry), add:

```ts
      promo_cards: {
        Row: {
          id: string
          heading: string
          subtext: string | null
          badge_text: string | null
          cta_text: string | null
          cta_link: string | null
          color_theme: 'amber' | 'green' | 'blue' | 'purple' | 'red'
          coupon_id: string | null
          sort_order: number
          active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['promo_cards']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['promo_cards']['Insert']>
      }
```

- [ ] **Step 2: Add the convenience type alias**

At the bottom of `lib/supabase/types.ts`, after the `export type TrendingSearch` line, add:

```ts
export type PromoCard = Database['public']['Tables']['promo_cards']['Row']

// PromoCard with the joined coupon (used in admin list and homepage)
export interface PromoCardWithCoupon extends PromoCard {
  coupons: { code: string; type: string; value: number } | null
}
```

- [ ] **Step 3: Also update the `coupons` Row type** to include `'free_shipping'` (added in migration 010 but the type still says `'percentage' | 'fixed'`):

Find the coupons Row type in `lib/supabase/types.ts`:
```ts
          type: 'percentage' | 'fixed'
```
Change it to:
```ts
          type: 'percentage' | 'fixed' | 'free_shipping'
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: add PromoCard types and fix coupon free_shipping type"
```

---

## Task 3: Server actions

**Files:**
- Create: `lib/actions/promo-cards.ts`

- [ ] **Step 1: Create the file**

```ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { PromoCardWithCoupon } from '@/lib/supabase/types'

function revalidate() {
  revalidatePath('/admin/banner')
  revalidatePath('/')
}

export async function fetchPromoCardsAdmin(): Promise<PromoCardWithCoupon[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('promo_cards')
    .select('*, coupons(code, type, value)')
    .order('sort_order')
  return (data ?? []) as PromoCardWithCoupon[]
}

export async function fetchActivePromoCards(): Promise<PromoCardWithCoupon[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('promo_cards')
    .select('*, coupons(code, type, value)')
    .eq('active', true)
    .order('sort_order')
  return (data ?? []) as PromoCardWithCoupon[]
}

export async function createPromoCard(data: {
  heading: string
  subtext?: string | null
  badge_text?: string | null
  cta_text?: string | null
  cta_link?: string | null
  color_theme: 'amber' | 'green' | 'blue' | 'purple' | 'red'
  coupon_id?: string | null
  sort_order?: number
  active?: boolean
}) {
  if (!data.heading.trim()) return { error: 'Heading is required' }
  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from('promo_cards')
    .insert({
      heading: data.heading.trim(),
      subtext: data.subtext?.trim() || null,
      badge_text: data.badge_text?.trim() || null,
      cta_text: data.cta_text?.trim() || null,
      cta_link: data.cta_link?.trim() || null,
      color_theme: data.color_theme,
      coupon_id: data.coupon_id || null,
      sort_order: data.sort_order ?? 0,
      active: data.active ?? true,
    })
    .select('*, coupons(code, type, value)')
    .single()
  if (error) return { error: error.message }
  revalidate()
  return { success: true, data: row }
}

export async function updatePromoCard(
  id: string,
  data: {
    heading: string
    subtext?: string | null
    badge_text?: string | null
    cta_text?: string | null
    cta_link?: string | null
    color_theme: 'amber' | 'green' | 'blue' | 'purple' | 'red'
    coupon_id?: string | null
    sort_order?: number
    active?: boolean
  }
) {
  if (!data.heading.trim()) return { error: 'Heading is required' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('promo_cards')
    .update({
      heading: data.heading.trim(),
      subtext: data.subtext?.trim() || null,
      badge_text: data.badge_text?.trim() || null,
      cta_text: data.cta_text?.trim() || null,
      cta_link: data.cta_link?.trim() || null,
      color_theme: data.color_theme,
      coupon_id: data.coupon_id || null,
      sort_order: data.sort_order ?? 0,
      active: data.active ?? true,
    })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidate()
  return { success: true }
}

export async function deletePromoCard(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('promo_cards').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidate()
  return { success: true }
}

export async function togglePromoCard(id: string, active: boolean) {
  const admin = createAdminClient()
  const { error } = await admin.from('promo_cards').update({ active }).eq('id', id)
  if (error) return { error: error.message }
  revalidate()
  return { success: true }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/promo-cards.ts
git commit -m "feat: promo-cards server actions (CRUD + toggle)"
```

---

## Task 4: PromoCardForm admin component

**Files:**
- Create: `components/admin/PromoCardForm.tsx`

This is a client component rendered inside BannerManager when adding or editing a card. It follows the same inline-form pattern as `BannerSlideForm` in `BannerManager.tsx`.

- [ ] **Step 1: Create the file**

```tsx
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
      // Reconstruct updated card for optimistic UI
      const linkedCoupon = coupons.find((c) => c.id === form.coupon_id) ?? null
      onSaved({
        ...initial,
        ...payload,
        coupons: linkedCoupon
          ? { code: linkedCoupon.code, type: linkedCoupon.type, value: linkedCoupon.value }
          : null,
      })
    } else {
      // createPromoCard returns the full row with joined coupon
      onSaved((result as any).data as PromoCardWithCoupon)
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/PromoCardForm.tsx
git commit -m "feat: PromoCardForm admin component"
```

---

## Task 5: Update BannerManager — add Promo Cards tab

**Files:**
- Modify: `components/admin/BannerManager.tsx`

The current file has two tabs: `announcements` and `carousel`. Add a third: `promo`.

- [ ] **Step 1: Update imports at the top of `components/admin/BannerManager.tsx`**

Replace the existing imports block with:

```tsx
'use client'

import { useState } from 'react'
import { createAnnouncement, updateAnnouncement, deleteAnnouncement } from '@/lib/actions/announcements'
import { createBanner, updateBanner, deleteBanner } from '@/lib/actions/banners'
import { deletePromoCard, togglePromoCard } from '@/lib/actions/promo-cards'
import { Plus, Trash2, Save, X } from 'lucide-react'
import type { Banner, PromoCardWithCoupon } from '@/lib/supabase/types'
import PromoCardForm, { type CouponOption } from '@/components/admin/PromoCardForm'
```

- [ ] **Step 2: Update the component props interface and signature**

Replace:
```tsx
export default function BannerManager({
  initialMessages,
  initialBanners,
}: {
  initialMessages: Message[]
  initialBanners: Banner[]
}) {
```

With:
```tsx
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
```

- [ ] **Step 3: Add promo cards state below the carousel state block (after `function closeBannerForm`)**

```tsx
  // ── Promo cards state ─────────────────────────────────────────
  const [promoCards, setPromoCards] = useState<PromoCardWithCoupon[]>(initialPromoCards)
  const [editingPromo, setEditingPromo] = useState<PromoCardWithCoupon | null>(null)
  const [showPromoForm, setShowPromoForm] = useState(false)

  function closePromoForm() {
    setShowPromoForm(false)
    setEditingPromo(null)
  }
```

- [ ] **Step 4: Add `'promo'` to the tab switcher**

Replace:
```tsx
      {/* Tab switcher */}
      <div className="flex border-b border-gray-200 mb-6">
        {(['announcements', 'carousel'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'announcements' ? 'Announcement Bar' : 'Hero Carousel'}
          </button>
        ))}
      </div>
```

With:
```tsx
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
```

Also update the `useState` type:
```tsx
  const [tab, setTab] = useState<'announcements' | 'carousel' | 'promo'>('announcements')
```

- [ ] **Step 5: Add the Promo Cards tab panel**

After the closing `}` of the `{/* ── Carousel tab ── */}` block (before the final `</div>` that closes the component return), add:

```tsx
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
              {/* Color swatch */}
              <div
                className="w-10 h-10 rounded-lg shrink-0"
                style={{
                  background: {
                    amber: '#b45309', green: '#15803d', blue: '#1d4ed8',
                    purple: '#7c3aed', red: '#be123c',
                  }[card.color_theme],
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
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/admin/BannerManager.tsx
git commit -m "feat: add Promo Cards tab to BannerManager"
```

---

## Task 6: Update admin banner page

**Files:**
- Modify: `app/admin/banner/page.tsx`

The page needs to fetch `promo_cards` (all, for admin) and `coupons` (active, for the dropdown).

- [ ] **Step 1: Replace the full file content**

```tsx
export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import BannerManager from '@/components/admin/BannerManager'
import { fetchPromoCardsAdmin } from '@/lib/actions/promo-cards'

export const metadata: Metadata = { title: 'Banner Management' }

export default async function BannerPage() {
  const admin = createAdminClient()
  const [{ data: messages }, { data: banners }, promoCards, { data: coupons }] = await Promise.all([
    admin.from('announcements').select('*').order('sort_order'),
    admin.from('banners').select('*').order('sort_order'),
    fetchPromoCardsAdmin(),
    admin.from('coupons').select('id, code, type, value').eq('active', true).order('code'),
  ])

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Banner Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage the announcement bar, hero carousel slides, and promo cards.
        </p>
      </div>
      <BannerManager
        initialMessages={messages ?? []}
        initialBanners={banners ?? []}
        initialPromoCards={promoCards}
        coupons={coupons ?? []}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/banner/page.tsx
git commit -m "feat: pass promo cards and coupons to BannerManager"
```

---

## Task 7: Update homepage

**Files:**
- Modify: `app/(store)/page.tsx`

Replace the hardcoded promo banner block with a dynamic render from `promo_cards`.

- [ ] **Step 1: Add the import for `fetchActivePromoCards`**

At the top of `app/(store)/page.tsx`, add this import alongside the existing ones (do not duplicate lucide-react imports that are already there):

```tsx
import { fetchActivePromoCards } from '@/lib/actions/promo-cards'
```

- [ ] **Step 2: Add `promoCards` to the `Promise.all` fetch**

The current fetch in `HomePage` is:
```tsx
  const [banners, flashSale, brands, { data: deals }, { data: products }, { data: categories }] = await Promise.all([
```

Replace with:
```tsx
  const [banners, flashSale, brands, { data: deals }, { data: products }, { data: categories }, promoCards] = await Promise.all([
      fetchBanners(),
      fetchActiveFlashSale(),
      fetchBrands(),
      supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .eq('featured', true)
        .not('compare_at_price', 'is', null)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('categories')
        .select('*')
        .is('parent_id', null)
        .order('sort_order'),
      fetchActivePromoCards(),
    ])
```

- [ ] **Step 3: Define the color theme map** (add this just before the `return` statement in `HomePage`)

```tsx
  const THEME_STYLES: Record<string, { gradient: string; accent: string; accentBg: string; border: string }> = {
    amber:  { gradient: 'from-[#fdf3e3] via-[#faecd8] to-[#f5d5a0]', accent: '#b45309', accentBg: 'rgba(180,83,9,0.1)', border: '#ede8df' },
    green:  { gradient: 'from-[#f0fdf4] via-[#dcfce7] to-[#bbf7d0]',  accent: '#15803d', accentBg: 'rgba(21,128,61,0.1)',  border: '#bbf7d0' },
    blue:   { gradient: 'from-[#eff6ff] via-[#dbeafe] to-[#bfdbfe]',  accent: '#1d4ed8', accentBg: 'rgba(29,78,216,0.1)',  border: '#bfdbfe' },
    purple: { gradient: 'from-[#faf5ff] via-[#ede9fe] to-[#ddd6fe]',  accent: '#7c3aed', accentBg: 'rgba(124,58,237,0.1)', border: '#ddd6fe' },
    red:    { gradient: 'from-[#fff1f2] via-[#ffe4e6] to-[#fecdd3]',  accent: '#be123c', accentBg: 'rgba(190,18,60,0.1)',   border: '#fecdd3' },
  }
```

- [ ] **Step 4: Replace the hardcoded promo banner block**

Find and delete the entire `{/* Promo banner */}` block (lines 138–160 of the original file):
```tsx
      {/* Promo banner */}
      <AnimateIn direction="up" className="max-w-7xl mx-auto px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#fdf3e3] via-[#faecd8] to-[#f5d5a0] p-8 md:p-12 border border-[#ede8df]">
          ...
        </div>
      </AnimateIn>
```

Replace it with:
```tsx
      {/* Promo cards — dynamic from DB */}
      {promoCards.length > 0 && (
        <AnimateIn direction="up" className="max-w-7xl mx-auto px-4 py-16">
          <div className={`grid gap-6 ${promoCards.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            {promoCards.map((card) => {
              const theme = THEME_STYLES[card.color_theme] ?? THEME_STYLES.amber
              return (
                <div
                  key={card.id}
                  className={`relative overflow-hidden rounded-3xl bg-gradient-to-r ${theme.gradient} p-8 md:p-10 border`}
                  style={{ borderColor: theme.border }}
                >
                  <div className="relative z-10">
                    {card.badge_text && (
                      <div
                        className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-4"
                        style={{ background: theme.accentBg, color: theme.accent }}
                      >
                        <Zap size={12} className="fill-current" />
                        {card.badge_text}
                      </div>
                    )}
                    <h3 className="text-2xl md:text-3xl font-extrabold text-[#0a0a0a] mb-3">
                      {card.heading}
                    </h3>
                    {card.subtext && (
                      <p className="text-[#6b6360] mb-4 max-w-sm text-sm md:text-base">
                        {card.subtext}
                      </p>
                    )}
                    {card.coupons && (
                      <p className="text-[#6b6360] mb-5 text-sm">
                        Use code{' '}
                        <span
                          className="font-bold bg-white px-2 py-0.5 rounded-lg border"
                          style={{ borderColor: theme.border }}
                        >
                          {card.coupons.code}
                        </span>
                      </p>
                    )}
                    {card.cta_text && card.cta_link && (
                      <Link
                        href={card.cta_link}
                        className="inline-flex items-center gap-2 bg-[#0a0a0a] text-white font-bold px-5 py-2.5 rounded-xl hover:bg-[#1a1a1a] transition-colors shadow-lg text-sm"
                      >
                        {card.cta_text} <ArrowRight size={15} />
                      </Link>
                    )}
                  </div>
                  <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full" style={{ background: theme.accentBg }} />
                  <div className="absolute -right-20 bottom-0 w-64 h-64 rounded-full" style={{ background: theme.accentBg, opacity: 0.5 }} />
                </div>
              )
            })}
          </div>
        </AnimateIn>
      )}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/\(store\)/page.tsx
git commit -m "feat: render dynamic promo cards on homepage, remove hardcoded banner"
```

---

## Post-implementation: link the ACCRA200 coupon

After the migration runs and the code is deployed:

1. Go to `/admin/coupons` and create the `ACCRA200` coupon (type: Free Shipping, min order: GHS 200, active: on) — if it doesn't already exist.
2. Go to `/admin/banner` → **Promo Cards** tab.
3. Click **Edit** on the seeded "Free Delivery in Accra" card.
4. Select `ACCRA200 — Free Shipping` from the Coupon dropdown.
5. Save.
