# Homepage Jumia-Style Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five Jumia-style homepage sections (hero carousel, flash sales, deals of the day, brand storefronts, search autocomplete) with matching admin pages to manage each.

**Architecture:** Single migration adds 4 new tables and 1 column; server actions follow the existing `createAdminClient()` / `revalidatePath()` pattern; homepage fetches all data in parallel via `Promise.all`. The static `HeroBanner` is deleted and replaced with a client-side `HeroCarousel`.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL + RLS + Storage), Tailwind CSS, Framer Motion, Lucide icons, TypeScript.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/009_homepage_features.sql` | Create | DB schema for banners, flash_sales, flash_sale_items, brands, trending_searches + brand_id on products |
| `lib/supabase/types.ts` | Modify | Add Row/Insert/Update types + convenience aliases for all 5 new tables |
| `lib/actions/banners.ts` | Create | CRUD for banners table |
| `lib/actions/flash-sales.ts` | Create | CRUD for flash_sales + flash_sale_items |
| `lib/actions/brands.ts` | Create | CRUD for brands + assign brand_id on products |
| `lib/actions/trending-searches.ts` | Create | CRUD for trending_searches |
| `components/store/HeroCarousel.tsx` | Create | Auto-advancing carousel replacing HeroBanner |
| `components/store/HeroBanner.tsx` | Delete | Replaced by HeroCarousel |
| `components/store/FlashSalesSection.tsx` | Create | Flash sale row with live countdown |
| `components/store/DealsOfTheDay.tsx` | Create | Featured products with discount badge |
| `components/store/BrandStorefronts.tsx` | Create | Brand logo tile row |
| `components/store/SearchBar.tsx` | Create | Search input with autocomplete dropdown |
| `app/api/search/suggestions/route.ts` | Create | GET endpoint returning product name suggestions |
| `app/(store)/page.tsx` | Modify | Wire all new sections, parallel fetches |
| `app/(store)/products/page.tsx` | Modify | Support `?brand=<slug>` filter |
| `components/admin/BannerManager.tsx` | Modify | Add "Hero Carousel" tab |
| `app/admin/banner/page.tsx` | Modify | Fetch banners + pass to BannerManager |
| `components/admin/FlashSaleForm.tsx` | Create | Create/edit form for flash sales + inline items |
| `app/admin/flash-sales/page.tsx` | Create | Flash sales list |
| `app/admin/flash-sales/new/page.tsx` | Create | New flash sale form |
| `app/admin/flash-sales/[id]/edit/page.tsx` | Create | Edit flash sale form |
| `components/admin/BrandForm.tsx` | Create | Create/edit form for brands |
| `app/admin/brands/page.tsx` | Create | Brands list |
| `app/admin/brands/new/page.tsx` | Create | New brand form |
| `app/admin/brands/[id]/edit/page.tsx` | Create | Edit brand + link products |
| `app/admin/trending-searches/page.tsx` | Create | Trending searches manager |
| `components/admin/AdminSidebar.tsx` | Modify | Add Flash Sales, Brands, Trending Searches nav items |
| `components/store/Navbar.tsx` | Modify | Swap raw search input for SearchBar component |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/009_homepage_features.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/009_homepage_features.sql

-- ─── Hero carousel banners ───────────────────────────────────────────────────
CREATE TABLE public.banners (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  subtitle   text,
  image_url  text NOT NULL,
  cta_text   text,
  cta_link   text,
  sort_order int NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active banners" ON public.banners
  FOR SELECT USING (active = true);
CREATE POLICY "Admins manage banners" ON public.banners
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ─── Flash sales ─────────────────────────────────────────────────────────────
CREATE TABLE public.flash_sales (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active flash sales" ON public.flash_sales
  FOR SELECT USING (active = true);
CREATE POLICY "Admins manage flash sales" ON public.flash_sales
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE public.flash_sale_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flash_sale_id uuid NOT NULL REFERENCES public.flash_sales(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sale_price    numeric(10,2) NOT NULL,
  sort_order    int NOT NULL DEFAULT 0,
  UNIQUE(flash_sale_id, product_id)
);
ALTER TABLE public.flash_sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read flash sale items" ON public.flash_sale_items
  FOR SELECT USING (true);
CREATE POLICY "Admins manage flash sale items" ON public.flash_sale_items
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ─── Brands ──────────────────────────────────────────────────────────────────
CREATE TABLE public.brands (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  logo_url   text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active brands" ON public.brands
  FOR SELECT USING (active = true);
CREATE POLICY "Admins manage brands" ON public.brands
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.products
  ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;

-- ─── Trending searches ───────────────────────────────────────────────────────
CREATE TABLE public.trending_searches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query      text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trending_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active trending searches" ON public.trending_searches
  FOR SELECT USING (active = true);
CREATE POLICY "Admins manage trending searches" ON public.trending_searches
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
# or if using the dashboard: paste into SQL editor and run
```

Expected: no errors, 4 new tables visible in Supabase dashboard + `brand_id` column on products.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/009_homepage_features.sql
git commit -m "feat: add DB tables for banners, flash sales, brands, trending searches"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `lib/supabase/types.ts`

- [ ] **Step 1: Add new table definitions to the `Database` interface**

Inside `Database['public']['Tables']`, after the `coupons` block, add:

```typescript
      banners: {
        Row: {
          id: string
          title: string
          subtitle: string | null
          image_url: string
          cta_text: string | null
          cta_link: string | null
          sort_order: number
          active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['banners']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['banners']['Insert']>
      }
      flash_sales: {
        Row: {
          id: string
          title: string
          starts_at: string
          ends_at: string
          active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['flash_sales']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['flash_sales']['Insert']>
      }
      flash_sale_items: {
        Row: {
          id: string
          flash_sale_id: string
          product_id: string
          sale_price: number
          sort_order: number
        }
        Insert: Omit<Database['public']['Tables']['flash_sale_items']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['flash_sale_items']['Insert']>
      }
      brands: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string
          sort_order: number
          active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['brands']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['brands']['Insert']>
      }
      trending_searches: {
        Row: {
          id: string
          query: string
          sort_order: number
          active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['trending_searches']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['trending_searches']['Insert']>
      }
```

- [ ] **Step 2: Add `brand_id` to the products Row**

In the `products.Row` block, add after `featured: boolean`:

```typescript
          brand_id: string | null
```

- [ ] **Step 3: Add convenience aliases after the existing ones**

After `export type Coupon = ...`, add:

```typescript
export type Banner = Database['public']['Tables']['banners']['Row']
export type FlashSale = Database['public']['Tables']['flash_sales']['Row']
export type FlashSaleItem = Database['public']['Tables']['flash_sale_items']['Row']
export type Brand = Database['public']['Tables']['brands']['Row']
export type TrendingSearch = Database['public']['Tables']['trending_searches']['Row']

// Flash sale with items + joined product data
export interface FlashSaleWithItems extends FlashSale {
  items: Array<FlashSaleItem & { product: Product }>
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: add TypeScript types for banners, flash sales, brands, trending searches"
```

---

## Task 3: Banner Server Actions

**Files:**
- Create: `lib/actions/banners.ts`

- [ ] **Step 1: Write the actions file**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Banner } from '@/lib/supabase/types'

export async function fetchBanners(): Promise<Banner[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('banners')
    .select('*')
    .eq('active', true)
    .order('sort_order')
  return data ?? []
}

export async function fetchAllBannersAdmin(): Promise<Banner[]> {
  const admin = createAdminClient()
  const { data } = await admin.from('banners').select('*').order('sort_order')
  return data ?? []
}

export async function createBanner(formData: FormData) {
  const admin = createAdminClient()
  const { error } = await admin.from('banners').insert({
    title: formData.get('title') as string,
    subtitle: (formData.get('subtitle') as string) || null,
    image_url: formData.get('image_url') as string,
    cta_text: (formData.get('cta_text') as string) || null,
    cta_link: (formData.get('cta_link') as string) || null,
    sort_order: Number(formData.get('sort_order') ?? 0),
    active: formData.get('active') === 'true',
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/banner')
  revalidatePath('/')
  return { success: true }
}

export async function updateBanner(id: string, formData: FormData) {
  const admin = createAdminClient()
  const { error } = await admin.from('banners').update({
    title: formData.get('title') as string,
    subtitle: (formData.get('subtitle') as string) || null,
    image_url: formData.get('image_url') as string,
    cta_text: (formData.get('cta_text') as string) || null,
    cta_link: (formData.get('cta_link') as string) || null,
    sort_order: Number(formData.get('sort_order') ?? 0),
    active: formData.get('active') === 'true',
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/banner')
  revalidatePath('/')
  return { success: true }
}

export async function deleteBanner(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('banners').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/banner')
  revalidatePath('/')
  return { success: true }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/banners.ts
git commit -m "feat: add banner server actions"
```

---

## Task 4: Hero Carousel Component

**Files:**
- Create: `components/store/HeroCarousel.tsx`

- [ ] **Step 1: Write the component**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import type { Banner } from '@/lib/supabase/types'

const FALLBACK: Banner = {
  id: 'fallback',
  title: 'Shop the Latest in Ghana',
  subtitle: 'Electronics, Fashion, Home & more. Fast delivery across all 16 regions.',
  image_url: '',
  cta_text: 'Shop Now',
  cta_link: '/products',
  sort_order: 0,
  active: true,
  created_at: '',
}

export default function HeroCarousel({ banners }: { banners: Banner[] }) {
  const slides = banners.length > 0 ? banners : [FALLBACK]
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const next = useCallback(() => setIndex((i) => (i + 1) % slides.length), [slides.length])
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length)

  useEffect(() => {
    if (paused || slides.length <= 1) return
    const id = setInterval(next, 5000)
    return () => clearInterval(id)
  }, [paused, next, slides.length])

  const slide = slides[index]

  return (
    <div
      className="relative w-full overflow-hidden bg-[#0a0a0a]"
      style={{ minHeight: '420px' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {slide.image_url ? (
            <img
              src={slide.image_url}
              alt={slide.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0a0a0a] via-[#1a1209] to-[#3d1f00]" />
          )}
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 flex flex-col justify-center h-full py-20 md:py-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={`content-${slide.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="max-w-xl"
          >
            <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-4">
              {slide.title}
            </h1>
            {slide.subtitle && (
              <p className="text-white/70 text-sm md:text-base mb-7 max-w-sm">
                {slide.subtitle}
              </p>
            )}
            {slide.cta_link && (
              <Link
                href={slide.cta_link}
                className="inline-flex items-center gap-2 bg-[#b45309] hover:bg-[#92400e] text-white font-bold px-6 py-3 rounded-xl transition-colors shadow-lg text-sm"
              >
                {slide.cta_text ?? 'Shop Now'} <ArrowRight size={16} />
              </Link>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Arrows — only if more than 1 slide */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`rounded-full transition-all ${
                i === index ? 'w-6 h-2 bg-[#b45309]' : 'w-2 h-2 bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/store/HeroCarousel.tsx
git commit -m "feat: add HeroCarousel component with auto-advance and fallback slide"
```

---

## Task 5: Extend Admin Banner Page for Carousel

**Files:**
- Modify: `app/admin/banner/page.tsx`
- Modify: `components/admin/BannerManager.tsx`

- [ ] **Step 1: Update `app/admin/banner/page.tsx`** to fetch both announcements and banners

Replace the entire file with:

```typescript
export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import BannerManager from '@/components/admin/BannerManager'

export const metadata: Metadata = { title: 'Banner Management' }

export default async function BannerPage() {
  const admin = createAdminClient()
  const [{ data: messages }, { data: banners }] = await Promise.all([
    admin.from('announcements').select('*').order('sort_order'),
    admin.from('banners').select('*').order('sort_order'),
  ])

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Banner Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage the announcement bar and hero carousel slides.
        </p>
      </div>
      <BannerManager initialMessages={messages ?? []} initialBanners={banners ?? []} />
    </div>
  )
}
```

- [ ] **Step 2: Read the current BannerManager to understand its structure**

Read `components/admin/BannerManager.tsx` fully before editing.

- [ ] **Step 3: Add a `initialBanners` prop and "Hero Carousel" tab to `BannerManager.tsx`**

The component must keep all existing announcement functionality untouched and add a second tab. The new tab renders a list of banner slides with Create/Edit/Delete. Add this to the top of the file (after existing imports):

```typescript
import { createBanner, updateBanner, deleteBanner } from '@/lib/actions/banners'
import type { Banner } from '@/lib/supabase/types'
```

Add `initialBanners: Banner[]` to the props interface and a `tab` state:

```typescript
const [tab, setTab] = useState<'announcements' | 'carousel'>('announcements')
const [banners, setBanners] = useState<Banner[]>(initialBanners)
const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
const [showBannerForm, setShowBannerForm] = useState(false)
```

Wrap existing JSX in a tab container. At the top of the returned JSX, add:

```tsx
<div className="flex border-b border-gray-200 mb-6">
  {(['announcements', 'carousel'] as const).map((t) => (
    <button
      key={t}
      onClick={() => setTab(t)}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
        tab === t
          ? 'border-green-600 text-green-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {t === 'announcements' ? 'Announcement Bar' : 'Hero Carousel'}
    </button>
  ))}
</div>

{tab === 'announcements' && (
  /* existing announcement JSX here — no changes */
  <>{/* ...existing content... */}</>
)}

{tab === 'carousel' && (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <p className="text-sm text-gray-500">{banners.length} slide{banners.length !== 1 ? 's' : ''}</p>
      <button
        onClick={() => { setEditingBanner(null); setShowBannerForm(true) }}
        className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
      >
        + Add Slide
      </button>
    </div>

    {showBannerForm && (
      <BannerSlideForm
        initial={editingBanner}
        onCancel={() => { setShowBannerForm(false); setEditingBanner(null) }}
        onSaved={() => { setShowBannerForm(false); setEditingBanner(null) }}
      />
    )}

    {banners.length === 0 && !showBannerForm && (
      <div className="text-center py-12 text-gray-400 text-sm">No slides yet. Add one above.</div>
    )}

    {banners.map((b) => (
      <div key={b.id} className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        {b.image_url && (
          <img src={b.image_url} alt={b.title} className="w-20 h-12 object-cover rounded-lg shrink-0" />
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
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => { setEditingBanner(b); setShowBannerForm(true) }}
            className="text-xs text-blue-600 hover:underline"
          >Edit</button>
          <button
            onClick={async () => {
              if (!confirm('Delete this slide?')) return
              await deleteBanner(b.id)
              setBanners((prev) => prev.filter((x) => x.id !== b.id))
            }}
            className="text-xs text-red-500 hover:underline"
          >Delete</button>
        </div>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 4: Add `BannerSlideForm` as an inner component in the same file**

```typescript
function BannerSlideForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: Banner | null
  onCancel: () => void
  onSaved: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = initial
      ? await updateBanner(initial.id, fd)
      : await createBanner(fd)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">{initial ? 'Edit Slide' : 'New Slide'}</h3>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
          <input name="title" defaultValue={initial?.title} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Subtitle</label>
          <input name="subtitle" defaultValue={initial?.subtitle ?? ''}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Image URL *</label>
          <input name="image_url" defaultValue={initial?.image_url} required type="url"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">CTA Text</label>
          <input name="cta_text" defaultValue={initial?.cta_text ?? ''}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">CTA Link</label>
          <input name="cta_link" defaultValue={initial?.cta_link ?? ''}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sort Order</label>
          <input name="sort_order" type="number" defaultValue={initial?.sort_order ?? 0}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input name="active" type="checkbox" id="banner-active" value="true"
            defaultChecked={initial?.active ?? true} className="rounded" />
          <label htmlFor="banner-active" className="text-sm text-gray-700">Active</label>
          <input type="hidden" name="active" value="false" />
        </div>
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50">
          {loading ? 'Saving…' : 'Save Slide'}
        </button>
        <button type="button" onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
          Cancel
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 5: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add app/admin/banner/page.tsx components/admin/BannerManager.tsx
git commit -m "feat: add hero carousel tab to admin banner management"
```

---

## Task 6: Flash Sale Server Actions

**Files:**
- Create: `lib/actions/flash-sales.ts`

- [ ] **Step 1: Write the actions file**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FlashSale, FlashSaleWithItems } from '@/lib/supabase/types'

export async function fetchActiveFlashSale(): Promise<FlashSaleWithItems | null> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data: sale } = await supabase
    .from('flash_sales')
    .select('*')
    .eq('active', true)
    .lte('starts_at', now)
    .gt('ends_at', now)
    .order('starts_at')
    .limit(1)
    .single()

  if (!sale) return null

  const { data: items } = await supabase
    .from('flash_sale_items')
    .select('*, product:products(*)')
    .eq('flash_sale_id', sale.id)
    .order('sort_order')

  return { ...sale, items: (items ?? []) as FlashSaleWithItems['items'] }
}

export async function fetchAllFlashSalesAdmin(): Promise<FlashSale[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('flash_sales')
    .select('*')
    .order('starts_at', { ascending: false })
  return data ?? []
}

export interface FlashSaleItemInput {
  product_id: string
  sale_price: number
  sort_order: number
}

export async function createFlashSale(
  title: string,
  starts_at: string,
  ends_at: string,
  active: boolean,
  items: FlashSaleItemInput[]
) {
  const admin = createAdminClient()
  const { data: sale, error } = await admin
    .from('flash_sales')
    .insert({ title, starts_at, ends_at, active })
    .select()
    .single()
  if (error || !sale) return { error: error?.message ?? 'Failed to create sale' }

  if (items.length > 0) {
    const { error: itemError } = await admin.from('flash_sale_items').insert(
      items.map((item) => ({ ...item, flash_sale_id: sale.id }))
    )
    if (itemError) return { error: itemError.message }
  }

  revalidatePath('/admin/flash-sales')
  revalidatePath('/')
  return { success: true, id: sale.id }
}

export async function updateFlashSale(
  id: string,
  title: string,
  starts_at: string,
  ends_at: string,
  active: boolean,
  items: FlashSaleItemInput[]
) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('flash_sales')
    .update({ title, starts_at, ends_at, active })
    .eq('id', id)
  if (error) return { error: error.message }

  // Replace all items: delete existing, insert new
  await admin.from('flash_sale_items').delete().eq('flash_sale_id', id)
  if (items.length > 0) {
    const { error: itemError } = await admin.from('flash_sale_items').insert(
      items.map((item) => ({ ...item, flash_sale_id: id }))
    )
    if (itemError) return { error: itemError.message }
  }

  revalidatePath('/admin/flash-sales')
  revalidatePath('/')
  return { success: true }
}

export async function deleteFlashSale(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('flash_sales').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/flash-sales')
  revalidatePath('/')
  return { success: true }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/actions/flash-sales.ts
git commit -m "feat: add flash sale server actions"
```

---

## Task 7: Flash Sale Admin Pages

**Files:**
- Create: `components/admin/FlashSaleForm.tsx`
- Create: `app/admin/flash-sales/page.tsx`
- Create: `app/admin/flash-sales/new/page.tsx`
- Create: `app/admin/flash-sales/[id]/edit/page.tsx`

- [ ] **Step 1: Write `components/admin/FlashSaleForm.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createFlashSale, updateFlashSale, type FlashSaleItemInput } from '@/lib/actions/flash-sales'
import { createAdminClient } from '@/lib/supabase/admin'
import type { FlashSale, FlashSaleWithItems, Product } from '@/lib/supabase/types'
import { formatGHS } from '@/lib/utils'
import { X, Plus } from 'lucide-react'

export default function FlashSaleForm({
  sale,
  allProducts,
}: {
  sale?: FlashSaleWithItems
  allProducts: Product[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState<Array<FlashSaleItemInput & { name: string; image: string }>>(
    sale?.items.map((i) => ({
      product_id: i.product_id,
      sale_price: i.sale_price,
      sort_order: i.sort_order,
      name: i.product.name,
      image: i.product.images?.[0] ?? '',
    })) ?? []
  )
  const [productSearch, setProductSearch] = useState('')

  const filteredProducts = allProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
      !items.some((i) => i.product_id === p.id)
  )

  function addProduct(p: Product) {
    setItems((prev) => [
      ...prev,
      { product_id: p.id, sale_price: p.price, sort_order: prev.length, name: p.name, image: p.images?.[0] ?? '' },
    ])
    setProductSearch('')
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.product_id !== productId))
  }

  function updatePrice(productId: string, price: number) {
    setItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, sale_price: price } : i))
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const payload = {
      title: fd.get('title') as string,
      starts_at: new Date(fd.get('starts_at') as string).toISOString(),
      ends_at: new Date(fd.get('ends_at') as string).toISOString(),
      active: fd.get('active') === 'on',
      items: items.map(({ product_id, sale_price, sort_order }) => ({ product_id, sale_price, sort_order })),
    }
    const result = sale
      ? await updateFlashSale(sale.id, payload.title, payload.starts_at, payload.ends_at, payload.active, payload.items)
      : await createFlashSale(payload.title, payload.starts_at, payload.ends_at, payload.active, payload.items)

    setLoading(false)
    if (result.error) { setError(result.error); return }
    router.push('/admin/flash-sales')
  }

  function toLocalDatetime(iso: string) {
    const d = new Date(iso)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Sale Details</h2>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
          <input name="title" defaultValue={sale?.title} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Starts At *</label>
            <input name="starts_at" type="datetime-local" required
              defaultValue={sale ? toLocalDatetime(sale.starts_at) : ''}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ends At *</label>
            <input name="ends_at" type="datetime-local" required
              defaultValue={sale ? toLocalDatetime(sale.ends_at) : ''}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input name="active" type="checkbox" defaultChecked={sale?.active ?? true} className="rounded" />
          Active
        </label>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Sale Items ({items.length})</h2>

        {/* Product search */}
        <div className="relative">
          <input
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Search products to add…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          {productSearch && filteredProducts.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredProducts.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 text-left text-sm"
                >
                  {p.images?.[0] && (
                    <img src={p.images[0]} alt={p.name} className="w-8 h-8 object-cover rounded" />
                  )}
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-gray-400 text-xs">{formatGHS(p.price)}</span>
                  <Plus size={14} className="text-green-600 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items list */}
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">No items yet. Search above to add products.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.product_id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                {item.image && (
                  <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded" />
                )}
                <span className="flex-1 text-sm font-medium text-gray-900 truncate">{item.name}</span>
                <div>
                  <label className="text-[10px] text-gray-400 block">Sale Price (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.sale_price}
                    onChange={(e) => updatePrice(item.product_id, Number(e.target.value))}
                    className="w-28 border border-gray-200 rounded px-2 py-1 text-sm"
                  />
                </div>
                <button type="button" onClick={() => removeItem(item.product_id)}
                  className="text-red-400 hover:text-red-600 ml-1">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl disabled:opacity-50">
          {loading ? 'Saving…' : sale ? 'Update Sale' : 'Create Sale'}
        </button>
        <button type="button" onClick={() => router.push('/admin/flash-sales')}
          className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5">
          Cancel
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Write `app/admin/flash-sales/page.tsx`**

```typescript
export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteFlashSale } from '@/lib/actions/flash-sales'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export const metadata: Metadata = { title: 'Flash Sales' }

function saleStatus(s: { active: boolean; starts_at: string; ends_at: string }) {
  const now = new Date()
  if (!s.active) return { label: 'Inactive', cls: 'bg-gray-100 text-gray-500' }
  if (new Date(s.starts_at) > now) return { label: 'Scheduled', cls: 'bg-blue-100 text-blue-600' }
  if (new Date(s.ends_at) < now) return { label: 'Ended', cls: 'bg-red-100 text-red-500' }
  return { label: 'Active', cls: 'bg-green-100 text-green-700' }
}

export default async function FlashSalesPage() {
  const admin = createAdminClient()
  const { data: sales } = await admin
    .from('flash_sales')
    .select('*, flash_sale_items(count)')
    .order('starts_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flash Sales</h1>
          <p className="text-sm text-gray-500 mt-0.5">{sales?.length ?? 0} sale{sales?.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/admin/flash-sales/new"
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={15} /> New Flash Sale
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {sales && sales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Starts</th>
                  <th className="px-4 py-3 text-left">Ends</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sales.map((s) => {
                  const status = saleStatus(s)
                  const itemCount = (s.flash_sale_items as unknown as { count: number }[])?.[0]?.count ?? 0
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">{s.title}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(s.starts_at).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(s.ends_at).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">{itemCount}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <Link href={`/admin/flash-sales/${s.id}/edit`}
                            className="text-xs text-blue-600 hover:underline">Edit</Link>
                          <form action={async () => { 'use server'; await deleteFlashSale(s.id) }}>
                            <button type="submit"
                              className="text-xs text-red-500 hover:underline"
                              onClick={(e) => { if (!confirm('Delete this flash sale?')) e.preventDefault() }}>
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-gray-400">
            <div className="text-4xl mb-3">⚡</div>
            <p className="font-medium">No flash sales yet</p>
            <Link href="/admin/flash-sales/new" className="text-sm text-green-600 hover:underline mt-1 inline-block">
              Create your first flash sale
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `app/admin/flash-sales/new/page.tsx`**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import FlashSaleForm from '@/components/admin/FlashSaleForm'

export const metadata: Metadata = { title: 'New Flash Sale' }

export default async function NewFlashSalePage() {
  const admin = createAdminClient()
  const { data: products } = await admin
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('name')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Flash Sale</h1>
      <FlashSaleForm allProducts={products ?? []} />
    </div>
  )
}
```

- [ ] **Step 4: Write `app/admin/flash-sales/[id]/edit/page.tsx`**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import FlashSaleForm from '@/components/admin/FlashSaleForm'
import type { FlashSaleWithItems } from '@/lib/supabase/types'

export const metadata: Metadata = { title: 'Edit Flash Sale' }

export default async function EditFlashSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const [{ data: sale }, { data: products }] = await Promise.all([
    admin.from('flash_sales').select('*, items:flash_sale_items(*, product:products(*))').eq('id', id).single(),
    admin.from('products').select('*').eq('status', 'active').order('name'),
  ])
  if (!sale) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Flash Sale</h1>
      <FlashSaleForm sale={sale as unknown as FlashSaleWithItems} allProducts={products ?? []} />
    </div>
  )
}
```

- [ ] **Step 5: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add components/admin/FlashSaleForm.tsx app/admin/flash-sales/
git commit -m "feat: add flash sale admin pages"
```

---

## Task 8: Flash Sales Homepage Section

**Files:**
- Create: `components/store/FlashSalesSection.tsx`

- [ ] **Step 1: Write the component**

```typescript
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { formatGHS } from '@/lib/utils'
import type { FlashSaleWithItems } from '@/lib/supabase/types'

function useCountdown(endsAt: string) {
  const getRemaining = () => Math.max(0, new Date(endsAt).getTime() - Date.now())
  const [ms, setMs] = useState(getRemaining)

  useEffect(() => {
    if (ms <= 0) return
    const id = setInterval(() => setMs(getRemaining()), 1000)
    return () => clearInterval(id)
  }, [endsAt])

  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0')
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')
  const s = (totalSeconds % 60).toString().padStart(2, '0')
  return { h, m, s, expired: ms <= 0 }
}

export default function FlashSalesSection({ sale }: { sale: FlashSaleWithItems }) {
  const { h, m, s, expired } = useCountdown(sale.ends_at)
  if (expired) return null

  return (
    <section className="bg-[#0a0a0a] py-10">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#b45309] text-white rounded-xl p-2">
              <Zap size={18} className="fill-white" />
            </div>
            <div>
              <p className="text-[#b45309] text-xs font-bold uppercase tracking-widest">Limited Time</p>
              <h2 className="text-xl font-extrabold text-white">{sale.title}</h2>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-white/10 rounded-xl px-4 py-2">
            {[h, m, s].map((unit, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-white font-extrabold text-lg tabular-nums">{unit}</span>
                {i < 2 && <span className="text-white/40 font-bold">:</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Product scroll */}
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {sale.items.map(({ product, sale_price }) => {
            const discount =
              product.compare_at_price && product.compare_at_price > sale_price
                ? Math.round((1 - sale_price / product.compare_at_price) * 100)
                : null

            return (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="shrink-0 w-44 bg-white rounded-2xl overflow-hidden hover:shadow-xl transition-shadow group"
              >
                <div className="relative">
                  {product.images?.[0] && (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  {discount !== null && (
                    <span className="absolute top-2 left-2 bg-[#b45309] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      -{discount}%
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs text-gray-700 font-medium line-clamp-2 mb-2 leading-snug">{product.name}</p>
                  <p className="text-[#b45309] font-extrabold text-sm">{formatGHS(sale_price)}</p>
                  {product.compare_at_price && (
                    <p className="text-gray-400 text-xs line-through">{formatGHS(product.compare_at_price)}</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/store/FlashSalesSection.tsx
git commit -m "feat: add FlashSalesSection component with live countdown"
```

---

## Task 9: Deals of the Day Section

**Files:**
- Create: `components/store/DealsOfTheDay.tsx`

- [ ] **Step 1: Write the component**

```typescript
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import ProductCard from '@/components/store/ProductCard'
import AnimateIn from '@/components/ui/AnimateIn'
import { StaggerContainer, StaggerItem } from '@/components/ui/StaggerChildren'
import type { Product } from '@/lib/supabase/types'

export default function DealsOfTheDay({ products }: { products: Product[] }) {
  if (products.length === 0) return null

  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      <AnimateIn direction="up">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[#b45309] font-semibold text-xs mb-1 uppercase tracking-widest">Best Prices</p>
            <h2 className="text-3xl font-extrabold text-[#0a0a0a]">Deals of the Day</h2>
          </div>
          <Link
            href="/products?featured=true"
            className="hidden sm:flex items-center gap-1.5 text-[#b45309] hover:text-[#92400e] font-semibold text-sm transition-all hover:gap-2.5 group"
          >
            View all <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </AnimateIn>
      <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((product) => (
          <StaggerItem key={product.id}>
            <ProductCard product={product as any} />
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/store/DealsOfTheDay.tsx
git commit -m "feat: add DealsOfTheDay section component"
```

---

## Task 10: Brand Server Actions + Admin Pages

**Files:**
- Create: `lib/actions/brands.ts`
- Create: `components/admin/BrandForm.tsx`
- Create: `app/admin/brands/page.tsx`
- Create: `app/admin/brands/new/page.tsx`
- Create: `app/admin/brands/[id]/edit/page.tsx`

- [ ] **Step 1: Write `lib/actions/brands.ts`**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { slugify } from '@/lib/utils'
import type { Brand } from '@/lib/supabase/types'

export async function fetchBrands(): Promise<Brand[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('brands')
    .select('*')
    .eq('active', true)
    .order('sort_order')
  return data ?? []
}

export async function createBrand(formData: FormData) {
  const admin = createAdminClient()
  const name = formData.get('name') as string
  const { error } = await admin.from('brands').insert({
    name,
    slug: slugify(name),
    logo_url: formData.get('logo_url') as string,
    sort_order: Number(formData.get('sort_order') ?? 0),
    active: formData.get('active') === 'on',
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/brands')
  revalidatePath('/')
  return { success: true }
}

export async function updateBrand(id: string, formData: FormData) {
  const admin = createAdminClient()
  const name = formData.get('name') as string
  const { error } = await admin.from('brands').update({
    name,
    slug: slugify(name),
    logo_url: formData.get('logo_url') as string,
    sort_order: Number(formData.get('sort_order') ?? 0),
    active: formData.get('active') === 'on',
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/brands')
  revalidatePath('/')
  return { success: true }
}

export async function deleteBrand(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('brands').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/brands')
  revalidatePath('/')
  return { success: true }
}

export async function assignProductBrand(productId: string, brandId: string | null) {
  const admin = createAdminClient()
  const { error } = await admin.from('products').update({ brand_id: brandId }).eq('id', productId)
  if (error) return { error: error.message }
  revalidatePath('/admin/brands')
  return { success: true }
}
```

- [ ] **Step 2: Write `components/admin/BrandForm.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrand, updateBrand, assignProductBrand } from '@/lib/actions/brands'
import type { Brand, Product } from '@/lib/supabase/types'

export default function BrandForm({
  brand,
  linkedProducts,
  allProducts,
}: {
  brand?: Brand
  linkedProducts?: Product[]
  allProducts?: Product[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [linked, setLinked] = useState<Product[]>(linkedProducts ?? [])

  const unlinkedProducts = (allProducts ?? []).filter(
    (p) => !linked.some((l) => l.id === p.id) &&
      p.name.toLowerCase().includes(productSearch.toLowerCase())
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const result = brand ? await updateBrand(brand.id, fd) : await createBrand(fd)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    router.push('/admin/brands')
  }

  async function handleLink(product: Product) {
    await assignProductBrand(product.id, brand!.id)
    setLinked((prev) => [...prev, product])
    setProductSearch('')
  }

  async function handleUnlink(product: Product) {
    await assignProductBrand(product.id, null)
    setLinked((prev) => prev.filter((p) => p.id !== product.id))
  }

  return (
    <div className="space-y-6 max-w-xl">
      {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Brand Details</h2>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
          <input name="name" defaultValue={brand?.name} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Logo URL *</label>
          <input name="logo_url" defaultValue={brand?.logo_url} required type="url"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sort Order</label>
          <input name="sort_order" type="number" defaultValue={brand?.sort_order ?? 0}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input name="active" type="checkbox" defaultChecked={brand?.active ?? true} className="rounded" />
          Active
        </label>
        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl disabled:opacity-50">
            {loading ? 'Saving…' : brand ? 'Update Brand' : 'Create Brand'}
          </button>
          <button type="button" onClick={() => router.push('/admin/brands')}
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5">Cancel</button>
        </div>
      </form>

      {/* Link products — only shown in edit mode */}
      {brand && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Linked Products ({linked.length})</h2>
          <div className="relative">
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search products to link…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            {productSearch && unlinkedProducts.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {unlinkedProducts.slice(0, 6).map((p) => (
                  <button key={p.id} type="button" onClick={() => handleLink(p)}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-left text-sm">
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-green-600 text-xs font-medium">+ Link</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {linked.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-800">{p.name}</span>
              <button onClick={() => handleUnlink(p)} className="text-xs text-red-500 hover:underline">Unlink</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write `app/admin/brands/page.tsx`**

```typescript
export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteBrand } from '@/lib/actions/brands'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export const metadata: Metadata = { title: 'Brands' }

export default async function BrandsPage() {
  const admin = createAdminClient()
  const { data: brands } = await admin.from('brands').select('*').order('sort_order')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brands</h1>
          <p className="text-sm text-gray-500 mt-0.5">{brands?.length ?? 0} brand{brands?.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/admin/brands/new"
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={15} /> New Brand
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {brands && brands.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {brands.map((b) => (
              <div key={b.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
                <img src={b.logo_url} alt={b.name} className="w-12 h-12 object-contain rounded-lg bg-gray-100 p-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{b.name}</p>
                  <p className="text-gray-400 text-xs">/{b.slug}</p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${b.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {b.active ? 'Active' : 'Hidden'}
                </span>
                <div className="flex gap-3">
                  <Link href={`/admin/brands/${b.id}/edit`} className="text-xs text-blue-600 hover:underline">Edit</Link>
                  <form action={async () => { 'use server'; await deleteBrand(b.id) }}>
                    <button type="submit" onClick={(e) => { if (!confirm('Delete brand?')) e.preventDefault() }}
                      className="text-xs text-red-500 hover:underline">Delete</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-gray-400">
            <div className="text-4xl mb-3">🏢</div>
            <p className="font-medium">No brands yet</p>
            <Link href="/admin/brands/new" className="text-sm text-green-600 hover:underline mt-1 inline-block">Add your first brand</Link>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write `app/admin/brands/new/page.tsx`**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import BrandForm from '@/components/admin/BrandForm'

export const metadata: Metadata = { title: 'New Brand' }

export default async function NewBrandPage() {
  const admin = createAdminClient()
  const { data: products } = await admin.from('products').select('*').eq('status', 'active').order('name')
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Brand</h1>
      <BrandForm allProducts={products ?? []} />
    </div>
  )
}
```

- [ ] **Step 5: Write `app/admin/brands/[id]/edit/page.tsx`**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BrandForm from '@/components/admin/BrandForm'

export const metadata: Metadata = { title: 'Edit Brand' }

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const [{ data: brand }, { data: linked }, { data: allProducts }] = await Promise.all([
    admin.from('brands').select('*').eq('id', id).single(),
    admin.from('products').select('*').eq('brand_id', id).order('name'),
    admin.from('products').select('*').eq('status', 'active').order('name'),
  ])
  if (!brand) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Brand</h1>
      <BrandForm brand={brand} linkedProducts={linked ?? []} allProducts={allProducts ?? []} />
    </div>
  )
}
```

- [ ] **Step 6: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add lib/actions/brands.ts components/admin/BrandForm.tsx app/admin/brands/
git commit -m "feat: add brand server actions and admin pages"
```

---

## Task 11: Brand Storefronts Homepage Section

**Files:**
- Create: `components/store/BrandStorefronts.tsx`

- [ ] **Step 1: Write the component**

```typescript
import Link from 'next/link'
import AnimateIn from '@/components/ui/AnimateIn'
import type { Brand } from '@/lib/supabase/types'

export default function BrandStorefronts({ brands }: { brands: Brand[] }) {
  if (brands.length === 0) return null

  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <AnimateIn direction="up">
        <div className="mb-6">
          <p className="text-[#b45309] font-semibold text-xs mb-1 uppercase tracking-widest">Top Brands</p>
          <h2 className="text-3xl font-extrabold text-[#0a0a0a]">Shop by Brand</h2>
        </div>
      </AnimateIn>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {brands.map((brand) => (
          <Link
            key={brand.id}
            href={`/products?brand=${brand.slug}`}
            className="shrink-0 flex flex-col items-center gap-2 group"
          >
            <div className="w-24 h-24 bg-white rounded-2xl border border-[#ede8df] flex items-center justify-center p-3 shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5 transition-all duration-200">
              <img
                src={brand.logo_url}
                alt={brand.name}
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <span className="text-xs font-semibold text-[#0a0a0a] group-hover:text-[#b45309] transition-colors text-center">
              {brand.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/store/BrandStorefronts.tsx
git commit -m "feat: add BrandStorefronts section component"
```

---

## Task 12: Trending Searches Admin

**Files:**
- Create: `lib/actions/trending-searches.ts`
- Create: `app/admin/trending-searches/page.tsx`

- [ ] **Step 1: Write `lib/actions/trending-searches.ts`**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TrendingSearch } from '@/lib/supabase/types'

export async function fetchTrendingSearches(): Promise<TrendingSearch[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('trending_searches')
    .select('*')
    .eq('active', true)
    .order('sort_order')
    .limit(8)
  return data ?? []
}

export async function addTrendingSearch(query: string) {
  if (!query.trim()) return { error: 'Query cannot be empty' }
  const admin = createAdminClient()
  const { count } = await admin
    .from('trending_searches')
    .select('*', { count: 'exact', head: true })
  const { error } = await admin.from('trending_searches').insert({
    query: query.trim(),
    sort_order: count ?? 0,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/trending-searches')
  return { success: true }
}

export async function updateTrendingSearch(id: string, data: { query?: string; sort_order?: number; active?: boolean }) {
  const admin = createAdminClient()
  const { error } = await admin.from('trending_searches').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/trending-searches')
  return { success: true }
}

export async function deleteTrendingSearch(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('trending_searches').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/trending-searches')
  return { success: true }
}
```

- [ ] **Step 2: Write `app/admin/trending-searches/page.tsx`**

```typescript
export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { addTrendingSearch, updateTrendingSearch, deleteTrendingSearch } from '@/lib/actions/trending-searches'
import type { Metadata } from 'next'
import TrendingSearchManager from '@/components/admin/TrendingSearchManager'

export const metadata: Metadata = { title: 'Trending Searches' }

export default async function TrendingSearchesPage() {
  const admin = createAdminClient()
  const { data: searches } = await admin
    .from('trending_searches')
    .select('*')
    .order('sort_order')

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Trending Searches</h1>
        <p className="text-sm text-gray-500 mt-1">
          Up to 8 active searches shown in the search bar dropdown.
        </p>
      </div>
      <TrendingSearchManager initialSearches={searches ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: Write `components/admin/TrendingSearchManager.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { addTrendingSearch, updateTrendingSearch, deleteTrendingSearch } from '@/lib/actions/trending-searches'
import type { TrendingSearch } from '@/lib/supabase/types'
import { X } from 'lucide-react'

export default function TrendingSearchManager({ initialSearches }: { initialSearches: TrendingSearch[] }) {
  const [searches, setSearches] = useState(initialSearches)
  const [newQuery, setNewQuery] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    if (!newQuery.trim()) return
    setAdding(true)
    const result = await addTrendingSearch(newQuery)
    setAdding(false)
    if (result.error) { alert(result.error); return }
    setNewQuery('')
    // Optimistic — page will revalidate
    setSearches((prev) => [
      ...prev,
      { id: Date.now().toString(), query: newQuery.trim(), sort_order: prev.length, active: true, created_at: '' },
    ])
  }

  async function handleToggle(s: TrendingSearch) {
    await updateTrendingSearch(s.id, { active: !s.active })
    setSearches((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)))
  }

  async function handleDelete(id: string) {
    await deleteTrendingSearch(id)
    setSearches((prev) => prev.filter((x) => x.id !== id))
  }

  async function handleSortOrder(id: string, order: number) {
    await updateTrendingSearch(id, { sort_order: order })
    setSearches((prev) => prev.map((x) => (x.id === id ? { ...x, sort_order: order } : x)))
  }

  return (
    <div className="space-y-4">
      {/* Add input */}
      <div className="flex gap-2">
        <input
          value={newQuery}
          onChange={(e) => setNewQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a search term…"
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
        />
        <button onClick={handleAdd} disabled={adding || !newQuery.trim()}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50">
          {adding ? '…' : 'Add'}
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {searches.length === 0 ? (
          <p className="text-center py-12 text-gray-400 text-sm">No trending searches yet.</p>
        ) : (
          searches.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <input
                type="number"
                value={s.sort_order}
                onChange={(e) => handleSortOrder(s.id, Number(e.target.value))}
                className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center"
              />
              <span className={`flex-1 text-sm ${s.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                {s.query}
              </span>
              <button onClick={() => handleToggle(s)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {s.active ? 'Active' : 'Hidden'}
              </button>
              <button onClick={() => handleDelete(s.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                <X size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add lib/actions/trending-searches.ts app/admin/trending-searches/ components/admin/TrendingSearchManager.tsx
git commit -m "feat: add trending searches admin and server actions"
```

---

## Task 13: Search Suggestions API + SearchBar Component

**Files:**
- Create: `app/api/search/suggestions/route.ts`
- Create: `components/store/SearchBar.tsx`

- [ ] **Step 1: Write `app/api/search/suggestions/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ suggestions: [] })

  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('name, slug')
    .eq('status', 'active')
    .ilike('name', `%${q}%`)
    .limit(6)

  return NextResponse.json({ suggestions: data ?? [] })
}
```

- [ ] **Step 2: Write `components/store/SearchBar.tsx`**

```typescript
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, TrendingUp } from 'lucide-react'
import type { TrendingSearch } from '@/lib/supabase/types'

type Suggestion = { name: string; slug: string }

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export default function SearchBar({
  trendingSearches,
  placeholder = 'Search products…',
}: {
  trendingSearches: TrendingSearch[]
  placeholder?: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debouncedQuery.length < 2) { setSuggestions([]); return }
    setLoading(true)
    fetch(`/api/search/suggestions?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then(({ suggestions }) => setSuggestions(suggestions))
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setOpen(false)
    router.push(`/products?q=${encodeURIComponent(query.trim())}`)
  }

  function handleTrending(q: string) {
    setQuery(q)
    setOpen(false)
    router.push(`/products?q=${encodeURIComponent(q)}`)
  }

  function handleSuggestion(slug: string) {
    setOpen(false)
    router.push(`/products/${slug}`)
  }

  const showDropdown = open && (query.length < 2 ? trendingSearches.length > 0 : true)

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            placeholder={placeholder}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#ede8df] bg-white text-sm text-[#0a0a0a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#b45309]/30 focus:border-[#b45309]"
          />
        </div>
      </form>

      {showDropdown && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-xl border border-[#ede8df] shadow-xl z-50 overflow-hidden">
          {query.length < 2 ? (
            <>
              <div className="px-4 pt-3 pb-1 flex items-center gap-1.5 text-[10px] text-gray-400 font-semibold uppercase tracking-widest">
                <TrendingUp size={11} /> Trending
              </div>
              <div className="flex flex-wrap gap-2 px-4 pb-3">
                {trendingSearches.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTrending(t.query)}
                    className="bg-[#fdf6ec] text-[#b45309] text-xs font-medium px-3 py-1.5 rounded-full hover:bg-[#b45309] hover:text-white transition-colors"
                  >
                    {t.query}
                  </button>
                ))}
              </div>
            </>
          ) : loading ? (
            <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">No results for "{query}"</div>
          ) : (
            <ul>
              {suggestions.map((s) => (
                <li key={s.slug}>
                  <button
                    onClick={() => handleSuggestion(s.slug)}
                    className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-[#fdf6ec] text-left text-sm text-gray-800"
                  >
                    <Search size={13} className="text-gray-300 shrink-0" />
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/search/suggestions/route.ts components/store/SearchBar.tsx
git commit -m "feat: add search suggestions API route and SearchBar autocomplete component"
```

---

## Task 14: Wire Up Navbar Search

**Files:**
- Modify: `components/store/Navbar.tsx`

- [ ] **Step 1: Read the current Navbar**

Open and read `components/store/Navbar.tsx` in full to find the search input element.

- [ ] **Step 2: Import SearchBar and fetch trending searches**

The Navbar is a server component (or has a server + client split). Locate where trending searches should be fetched. If Navbar is a server component, add at the top of the file:

```typescript
import SearchBar from '@/components/store/SearchBar'
import { fetchTrendingSearches } from '@/lib/actions/trending-searches'
```

Fetch trending searches inside the server component function:

```typescript
const trendingSearches = await fetchTrendingSearches()
```

- [ ] **Step 3: Replace the raw search `<input>` with `<SearchBar>`**

Find the existing search `<input>` element (it navigates to `/products?q=…`) and replace it with:

```tsx
<SearchBar trendingSearches={trendingSearches} />
```

- [ ] **Step 4: Verify build and check for client/server boundary issues**

```bash
npx tsc --noEmit
npm run build
```

If Navbar is a client component, move the `fetchTrendingSearches()` call to the parent layout and pass it as a prop.

- [ ] **Step 5: Commit**

```bash
git add components/store/Navbar.tsx
git commit -m "feat: integrate SearchBar with autocomplete into Navbar"
```

---

## Task 15: Products Page Brand Filter

**Files:**
- Modify: `app/(store)/products/page.tsx`

- [ ] **Step 1: Read the current products page**

Open and read `app/(store)/products/page.tsx` in full to understand the existing query and searchParams handling.

- [ ] **Step 2: Add `brand` to the searchParams type and query**

In the searchParams destructure, add `brand`:

```typescript
const { q, category, sort, brand } = await searchParams
```

In the Supabase query, add a conditional brand filter. First resolve the brand slug to a brand_id:

```typescript
let brandId: string | null = null
if (brand) {
  const { data: brandRow } = await supabase
    .from('brands')
    .select('id')
    .eq('slug', brand)
    .eq('active', true)
    .single()
  brandId = brandRow?.id ?? null
}
```

Then add to the products query:

```typescript
if (brandId) {
  query = query.eq('brand_id', brandId)
}
```

- [ ] **Step 3: Verify TypeScript and build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/(store)/products/page.tsx
git commit -m "feat: add brand filter support to products page"
```

---

## Task 16: Wire Up Homepage + Admin Sidebar

**Files:**
- Modify: `app/(store)/page.tsx`
- Delete: `components/store/HeroBanner.tsx`
- Modify: `components/admin/AdminSidebar.tsx`

- [ ] **Step 1: Rewrite `app/(store)/page.tsx`**

Replace the entire file:

```typescript
export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { fetchBanners } from '@/lib/actions/banners'
import { fetchActiveFlashSale } from '@/lib/actions/flash-sales'
import { fetchBrands } from '@/lib/actions/brands'
import HeroCarousel from '@/components/store/HeroCarousel'
import FlashSalesSection from '@/components/store/FlashSalesSection'
import CategoryGrid from '@/components/store/CategoryGrid'
import DealsOfTheDay from '@/components/store/DealsOfTheDay'
import BrandStorefronts from '@/components/store/BrandStorefronts'
import ProductCard from '@/components/store/ProductCard'
import AnimateIn from '@/components/ui/AnimateIn'
import { StaggerContainer, StaggerItem } from '@/components/ui/StaggerChildren'
import Link from 'next/link'
import { ArrowRight, Truck, ShieldCheck, RotateCcw, Headphones, Zap } from 'lucide-react'
import NewsletterForm from '@/components/store/NewsletterForm'

export default async function HomePage() {
  const supabase = await createClient()

  const [banners, flashSale, brands, { data: deals }, { data: products }, { data: categories }] =
    await Promise.all([
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
    ])

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      <HeroCarousel banners={banners} />

      {flashSale && <FlashSalesSection sale={flashSale} />}

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <AnimateIn direction="up">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[#b45309] font-semibold text-xs mb-1 uppercase tracking-widest">Browse</p>
              <h2 className="text-3xl font-extrabold text-[#0a0a0a]">Shop by Category</h2>
            </div>
            <Link href="/products" className="hidden sm:flex items-center gap-1.5 text-[#b45309] hover:text-[#92400e] font-semibold text-sm transition-all hover:gap-2.5 group">
              View all <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </AnimateIn>
        <CategoryGrid categories={categories ?? []} />
      </section>

      <DealsOfTheDay products={deals ?? []} />

      <BrandStorefronts brands={brands} />

      {/* New Arrivals */}
      <section className="max-w-7xl mx-auto px-4 pb-20">
        <AnimateIn direction="up">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[#b45309] font-semibold text-xs mb-1 uppercase tracking-widest">Just In</p>
              <h2 className="text-3xl font-extrabold text-[#0a0a0a]">New Arrivals</h2>
            </div>
            <Link href="/products" className="hidden sm:flex items-center gap-1.5 text-[#b45309] hover:text-[#92400e] font-semibold text-sm transition-all hover:gap-2.5 group">
              View all <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </AnimateIn>
        {products && products.length > 0 ? (
          <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <StaggerItem key={(product as any).id}>
                <ProductCard product={product as any} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : (
          <AnimateIn direction="up">
            <div className="text-center py-24 text-gray-400">
              <div className="text-6xl mb-4">🛍️</div>
              <p className="text-lg font-medium">No products yet</p>
              <p className="text-sm mt-1">Check back soon!</p>
            </div>
          </AnimateIn>
        )}
      </section>

      {/* Why Choose Us */}
      <AnimateIn direction="up">
        <section className="bg-[#f5f2ed] border-y border-[#ede8df]">
          <div className="max-w-7xl mx-auto px-4 py-16">
            <div className="text-center mb-12">
              <p className="text-[#b45309] font-semibold text-xs mb-2 uppercase tracking-widest">Why TeloMall</p>
              <h2 className="text-3xl font-extrabold text-[#0a0a0a]">Shopping made simple</h2>
              <p className="text-[#6b6360] mt-2 max-w-md mx-auto text-sm">
                Trusted by thousands of Ghanaians for fast, safe, and affordable online shopping.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Truck, title: 'Fast Delivery', desc: 'Same-day delivery in Accra. Next-day across Ghana.', color: 'bg-[#fdf6ec] text-[#b45309]' },
                { icon: ShieldCheck, title: 'Secure Payments', desc: 'MTN MoMo, Vodafone Cash, Visa, and more. 100% safe.', color: 'bg-[#fdf6ec] text-[#b45309]' },
                { icon: RotateCcw, title: 'Easy Returns', desc: '7-day hassle-free returns on all eligible items.', color: 'bg-[#fdf6ec] text-[#b45309]' },
                { icon: Headphones, title: '24/7 Support', desc: 'Our team is always ready to help via WhatsApp or phone.', color: 'bg-[#fdf6ec] text-[#b45309]' },
              ].map(({ icon: Icon, title, desc, color }) => (
                <div key={title} className="rounded-2xl border border-[#ede8df] bg-white p-5 text-center hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 group">
                  <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={22} />
                  </div>
                  <h3 className="font-bold text-[#0a0a0a] text-sm mb-1.5">{title}</h3>
                  <p className="text-[#6b6360] text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </AnimateIn>

      {/* Promo banner */}
      <AnimateIn direction="up" className="max-w-7xl mx-auto px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#fdf3e3] via-[#faecd8] to-[#f5d5a0] p-8 md:p-12 border border-[#ede8df]">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-[#b45309]/10 text-[#b45309] text-xs font-bold px-3 py-1.5 rounded-full mb-4">
              <Zap size={12} className="fill-current" />
              Limited Time Offer
            </div>
            <h3 className="text-3xl md:text-4xl font-extrabold text-[#0a0a0a] mb-4">Free Delivery in Accra</h3>
            <p className="text-[#6b6360] mb-6 max-w-sm text-sm md:text-base">
              On all orders over GHS 200. Use code{' '}
              <span className="font-bold bg-white px-2 py-0.5 rounded-lg border border-[#ede8df]">ACCRA200</span>
            </p>
            <Link href="/products" className="inline-flex items-center gap-2 bg-[#0a0a0a] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#1a1a1a] transition-colors shadow-lg">
              Shop Now <ArrowRight size={16} />
            </Link>
          </div>
          <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-[#b45309]/10" />
          <div className="absolute -right-20 bottom-0 w-72 h-72 rounded-full bg-[#b45309]/5" />
        </div>
      </AnimateIn>

      {/* Newsletter CTA */}
      <AnimateIn direction="up" className="max-w-7xl mx-auto px-4 pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-[#0a0a0a] text-white p-8 md:p-12 text-center">
          <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-white/5" />
          <div className="absolute top-1/2 right-1/4 w-24 h-24 rounded-full bg-[#b45309]/10" />
          <div className="relative z-10 max-w-xl mx-auto">
            <p className="text-[#b45309] text-xs font-semibold uppercase tracking-widest mb-3">Stay in the loop</p>
            <h3 className="text-2xl md:text-3xl font-extrabold mb-3">Get exclusive deals first!</h3>
            <p className="text-[#a89e96] text-sm mb-7 max-w-sm mx-auto">
              Subscribe to our newsletter and be the first to hear about flash sales, new arrivals, and special offers.
            </p>
            <NewsletterForm />
            <p className="text-[#6b6360] text-[11px] mt-3">No spam. Unsubscribe anytime.</p>
          </div>
        </div>
      </AnimateIn>

      {/* Payment methods strip */}
      <AnimateIn direction="up" className="border-t border-[#ede8df] bg-white">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <p className="text-center text-[#a89e96] text-xs font-semibold mb-5 uppercase tracking-widest">
            Secure payment with
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { label: 'MTN MoMo', color: 'bg-yellow-400 text-yellow-900' },
              { label: 'Vodafone Cash', color: 'bg-red-500 text-white' },
              { label: 'AirtelTigo', color: 'bg-blue-600 text-white' },
              { label: 'Visa / Mastercard', color: 'bg-[#0a0a0a] text-white' },
              { label: 'Bank Transfer', color: 'bg-[#b45309] text-white' },
            ].map(({ label, color }) => (
              <span key={label} className={`${color} text-xs font-bold px-4 py-2 rounded-xl shadow-sm hover:scale-105 transition-transform cursor-default`}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </AnimateIn>
    </div>
  )
}
```

- [ ] **Step 2: Delete `components/store/HeroBanner.tsx`**

```bash
rm components/store/HeroBanner.tsx
```

- [ ] **Step 3: Update `components/admin/AdminSidebar.tsx`** — add three new nav items

In the `NAV` array, add after the `Banner` entry:

```typescript
  { href: '/admin/flash-sales', label: 'Flash Sales', icon: Zap },
  { href: '/admin/brands', label: 'Brands', icon: Building2 },
  { href: '/admin/trending-searches', label: 'Trending Searches', icon: TrendingUp },
```

Add the new icons to the import:

```typescript
import { LayoutDashboard, Package, ShoppingBag, Tag, Users, Truck, Megaphone, Ticket, LogOut, ExternalLink, Zap, Building2, TrendingUp } from 'lucide-react'
```

- [ ] **Step 4: Full build check**

```bash
npm run build
```

Expected: no errors, no type errors. If there are import errors from `HeroBanner`, grep for remaining references:

```bash
grep -r "HeroBanner" --include="*.tsx" --include="*.ts" .
```

Remove any remaining imports.

- [ ] **Step 5: Start dev server and verify homepage visually**

```bash
npm run dev
```

Open http://localhost:3000 and confirm:
- Hero carousel renders (fallback slide if no banners configured)
- No Flash Sales section shows (none configured yet)
- Categories grid present
- Deals of the Day hidden (no featured products with compare_at_price yet)
- Brand Storefronts hidden (no brands yet)
- New Arrivals present
- All existing sections (Why Choose Us, Promo, Newsletter, Footer) unchanged

Open http://localhost:3000/admin/flash-sales — list page renders.
Open http://localhost:3000/admin/brands — list page renders.
Open http://localhost:3000/admin/trending-searches — manager renders.
Open http://localhost:3000/admin/banner — two tabs visible.

- [ ] **Step 6: Commit**

```bash
git add app/(store)/page.tsx components/admin/AdminSidebar.tsx
git commit -m "feat: wire up homepage with all new sections and update admin sidebar"
```

---

## Self-Review Checklist

Spec section → task coverage:

| Spec requirement | Covered in |
|---|---|
| `banners` table | Task 1 |
| `flash_sales` + `flash_sale_items` tables | Task 1 |
| `brands` table + `brand_id` on products | Task 1 |
| `trending_searches` table | Task 1 |
| TypeScript types for all new tables | Task 2 |
| Banner CRUD server actions | Task 3 |
| HeroCarousel component (replaces HeroBanner) | Task 4 |
| Admin banner page carousel tab | Task 5 |
| Flash sale server actions | Task 6 |
| Flash sale admin pages | Task 7 |
| FlashSalesSection with countdown | Task 8 |
| DealsOfTheDay section | Task 9 |
| Brand server actions + admin pages | Task 10 |
| BrandStorefronts section | Task 11 |
| Trending searches admin + actions | Task 12 |
| Search suggestions API + SearchBar | Task 13 |
| Navbar search replaced with SearchBar | Task 14 |
| Products page brand filter | Task 15 |
| Homepage wired up, HeroBanner deleted, sidebar updated | Task 16 |

All spec requirements covered.
