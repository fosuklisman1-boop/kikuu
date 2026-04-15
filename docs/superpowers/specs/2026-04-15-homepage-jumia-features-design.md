# Homepage Jumia-Style Features — Design Spec

**Date:** 2026-04-15
**Branch:** feat/preorder-flow-and-input-validation
**Status:** Approved, ready for implementation

---

## Overview

Add five Jumia-style homepage sections to Kikuu that are currently missing, along with the admin pages needed to manage their content. The goal is a homepage that matches the conversion-optimised layout of major African marketplaces (Jumia, Jiji).

### Features in scope

| Feature | DB work | Admin work | Homepage work |
|---|---|---|---|
| Hero Banner Carousel | New `banners` table | Extend `/admin/banner` | Replace `HeroBanner.tsx` |
| Flash Sales + Countdown | New `flash_sales` + `flash_sale_items` | New `/admin/flash-sales` | New `FlashSalesSection.tsx` |
| Deals of the Day | None (uses existing `featured` + `compare_at_price`) | None | New `DealsOfTheDay.tsx` |
| Brand Storefronts | New `brands` table + `brand_id` on products | New `/admin/brands` | New `BrandStorefronts.tsx` |
| Search Autocomplete + Trending | New `trending_searches` table | New `/admin/trending-searches` | Enhance `Navbar.tsx` search |

### Out of scope

- Recently viewed / personalisation
- Exit-intent popups
- Loyalty/rewards program
- Video content
- Mobile app download banner

---

## Build strategy

Single phase — all five features built together end-to-end (DB → admin → homepage). One PR when complete.

---

## Section 1: Data Layer

### New table: `banners`

Used by the hero carousel. Separate from the existing `announcements` table (which powers the text marquee bar — left untouched).

```sql
CREATE TABLE public.banners (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  subtitle     text,
  image_url    text NOT NULL,
  cta_text     text,
  cta_link     text,
  sort_order   int NOT NULL DEFAULT 0,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
-- Public: SELECT WHERE active = true, ORDER BY sort_order
-- Admin: full CRUD
```

### New table: `flash_sales`

```sql
CREATE TABLE public.flash_sales (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### New table: `flash_sale_items`

```sql
CREATE TABLE public.flash_sale_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flash_sale_id uuid NOT NULL REFERENCES public.flash_sales(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sale_price    numeric(10,2) NOT NULL,
  sort_order    int NOT NULL DEFAULT 0,
  UNIQUE(flash_sale_id, product_id)
);
```

**Active flash sale query:** `WHERE active = true AND starts_at <= now() AND ends_at > now()`. Only one sale is expected to be active at a time; if multiple match, the one with the earliest `starts_at` is used.

The homepage joins `flash_sale_items` → `products` and surfaces both `sale_price` (the discounted price) and the product's `compare_at_price` (shown as strikethrough "was" price).

### New table: `brands`

```sql
CREATE TABLE public.brands (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  logo_url   text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Altered table: `products`

```sql
ALTER TABLE public.products
  ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;
```

Nullable — existing products are unaffected. Brand filtering on `/products?brand=<slug>` joins through this column.

### New table: `trending_searches`

```sql
CREATE TABLE public.trending_searches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query      text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Admin-curated, max 8 shown in the search dropdown. No automatic tracking.

### Migration file

All changes in a single migration: `supabase/migrations/009_homepage_features.sql`

RLS policies for all new tables:
- Public role: `SELECT` on active rows only
- Admin role (via `is_admin()` helper): full CRUD

---

## Section 2: Homepage Layout

### Section order (top → bottom)

```
AnnouncementBar          (unchanged)
Navbar                   (search bar enhanced — see Section 4)
───────────────────────────────────────────
HeroCarousel             ← replaces HeroBanner.tsx
FlashSalesSection        ← new (hidden when no active sale)
CategoryGrid             (unchanged)
DealsOfTheDay            ← new
BrandStorefronts         ← new (hidden when no active brands)
NewArrivals              (unchanged)
WhyChooseUs              (unchanged)
PromoBanner              (unchanged)
NewsletterCTA            (unchanged)
PaymentMethods           (unchanged)
───────────────────────────────────────────
Footer                   (unchanged)
BottomTabBar             (unchanged)
```

### `HeroCarousel.tsx`

- Full-width, replaces `HeroBanner.tsx` entirely (deleted)
- Auto-advances every 5 seconds, pauses on hover
- Each slide: full-bleed background image, title, subtitle, CTA button (links to `cta_link`)
- Controls: dot indicators (bottom-center) + prev/next arrow buttons
- Fallback: if no active banners exist, renders a single static gradient slide with site name and "Shop Now" CTA — so the homepage never looks broken for a new install
- Framer Motion for slide transitions (consistent with existing animation patterns in the codebase)

### `FlashSalesSection.tsx`

- **Conditional:** rendered only when `activeFlashSale !== null`. No empty state shown to customers.
- Header row: "Flash Sales" title + fire emoji + live countdown (`HH:MM:SS`) in a highlighted badge
- Countdown runs client-side via a `useCountdown(endsAt: Date)` hook that ticks every second
- Product display: horizontally scrollable row of cards showing:
  - Product image
  - Product name (truncated to 2 lines)
  - `sale_price` in primary colour (bold)
  - `compare_at_price` in muted colour with strikethrough (only shown if present)
  - Discount percentage badge: `Math.round((1 - salePrice/compareAtPrice) * 100)%` off
- When countdown reaches zero, section hides client-side (no page reload needed)

### `DealsOfTheDay.tsx`

- Queries: `products WHERE featured = true AND compare_at_price IS NOT NULL LIMIT 8`
- Reuses the existing `ProductCard` component with a `discountBadge` prop overlay
- Section hidden if query returns 0 results
- Section heading: "Deals of the Day"

### `BrandStorefronts.tsx`

- Horizontally scrollable row of brand logo tiles (rounded squares, white background)
- Each tile: brand logo image + brand name below
- Links to `/products?brand=<slug>`
- Section hidden if no active brands exist

### Homepage data fetching

`app/(store)/page.tsx` already uses `force-dynamic`. Six parallel fetches added:

```ts
const [banners, flashSale, categories, deals, brands, newArrivals] =
  await Promise.all([
    fetchBanners(),
    fetchActiveFlashSale(),
    fetchCategories(),      // existing
    fetchFeaturedDeals(),
    fetchBrands(),
    fetchNewArrivals(),     // existing
  ])
```

All are Supabase server-client calls. No extra latency from new fetches since they run in parallel with the existing ones.

---

## Section 3: Admin Pages

### Extended: `/admin/banner`

Current page manages the `announcements` table. Extended with two tabs:

- **"Announcement Bar" tab** — existing behaviour, unchanged
- **"Hero Carousel" tab** — manages the new `banners` table:
  - List: thumbnail preview, title, sort order chip, active toggle, Edit/Delete actions
  - Create/Edit form: image upload (Supabase Storage → `banners/` bucket), title, subtitle, CTA text, CTA link, sort order, active toggle
  - Reorderable via sort order input (no drag-and-drop required)

### New: `/admin/flash-sales`

**List page (`/admin/flash-sales`):**
- Table: title, start datetime, end datetime, item count, status badge (Scheduled / Active / Ended), Edit/Delete actions
- "New Flash Sale" button

**Create/Edit page (`/admin/flash-sales/new` and `/admin/flash-sales/[id]/edit`):**
- Form fields: title, starts_at (datetime-local input), ends_at (datetime-local input), active toggle
- Below form: "Sale Items" section — product search input, results list, click to add. Each added item shows product name, image thumbnail, a `sale_price` input, sort order input, and remove button
- Save persists sale + items in a single server action (upsert items, delete removed ones)

**Components:**
- `components/admin/FlashSaleForm.tsx` — handles both create and edit

**Server actions:** `lib/actions/flash-sales.ts`
- `createFlashSale(data)` — inserts sale + items
- `updateFlashSale(id, data)` — updates sale + upserts/deletes items
- `deleteFlashSale(id)` — cascades to items via FK

### New: `/admin/brands`

**List page (`/admin/brands`):**
- Table: logo thumbnail, name, slug, sort order, active toggle, Edit/Delete actions
- "New Brand" button

**Create/Edit page (`/admin/brands/new` and `/admin/brands/[id]/edit`):**
- Form fields: name (slug auto-derived from name, editable), logo upload, sort order, active toggle
- Edit page only: "Linked Products" section — search products and set/clear their `brand_id`

**Components:**
- `components/admin/BrandForm.tsx`

**Server actions:** `lib/actions/brands.ts`
- `createBrand(data)`
- `updateBrand(id, data)`
- `deleteBrand(id)` — sets `brand_id = null` on linked products (handled by `ON DELETE SET NULL`)

### New: `/admin/trending-searches`

**Single page** (no sub-routes):
- Inline "Add search term" input at top
- List of existing terms: query text, sort order, active toggle, Delete button
- Sort order updated via number input per row
- No drag-and-drop needed — simple numeric ordering

**Server actions:** `lib/actions/trending-searches.ts`
- `addTrendingSearch(query)`
- `updateTrendingSearch(id, data)`
- `deleteTrendingSearch(id)`

### Admin sidebar

Three new items added to `components/admin/AdminSidebar.tsx`:
- Flash Sales (icon: bolt/lightning)
- Brands (icon: building/tag)
- Trending Searches (icon: magnifying glass / trending)

---

## Section 4: Search Autocomplete

### New component: `SearchBar.tsx` (client component)

Replaces the raw `<input>` in `Navbar.tsx`. Wraps the existing search input with dropdown behaviour.

**On focus (empty input):**
- Dropdown opens showing "Trending" label + up to 8 active `trending_searches` as clickable chips
- Clicking a chip: fills input + navigates to `/products?q=<query>`

**On type (≥2 characters, debounced 300ms):**
- Trending chips replaced by live product name suggestions
- Fetches `GET /api/search/suggestions?q=<query>` → returns `[{ name, slug }]` (max 6)
- Each suggestion: product name, click navigates to `/products/<slug>`

**On blur / Escape:** dropdown closes

**On Enter:** navigates to `/products?q=<input>` (existing search behaviour, unchanged)

### New route: `app/api/search/suggestions/route.ts`

```ts
GET /api/search/suggestions?q=<query>
// Returns: { suggestions: Array<{ name: string, slug: string }> }
// Query: products WHERE status='active' AND name ILIKE '%q%' LIMIT 6
// Returns 200 with empty array if q < 2 chars
```

---

## New files summary

```
supabase/migrations/009_homepage_features.sql
lib/supabase/types.ts                             (modified — add Banner, FlashSale, FlashSaleItem, Brand, TrendingSearch types)
app/(store)/page.tsx                              (modified)
components/store/HeroCarousel.tsx                 (new — replaces HeroBanner.tsx)
components/store/HeroBanner.tsx                   (deleted)
components/store/FlashSalesSection.tsx            (new)
components/store/DealsOfTheDay.tsx                (new)
components/store/BrandStorefronts.tsx             (new)
components/store/SearchBar.tsx                    (new)
app/api/search/suggestions/route.ts               (new)
app/(store)/products/page.tsx                     (modified — support ?brand=<slug> filter)
app/admin/banner/page.tsx                         (modified — add carousel tab)
components/admin/BannerManager.tsx                (modified — add carousel tab UI)
app/admin/flash-sales/page.tsx                    (new)
app/admin/flash-sales/new/page.tsx                (new)
app/admin/flash-sales/[id]/edit/page.tsx          (new)
components/admin/FlashSaleForm.tsx                (new)
lib/actions/flash-sales.ts                        (new)
app/admin/brands/page.tsx                         (new)
app/admin/brands/new/page.tsx                     (new)
app/admin/brands/[id]/edit/page.tsx               (new)
components/admin/BrandForm.tsx                    (new)
lib/actions/brands.ts                             (new)
app/admin/trending-searches/page.tsx              (new)
lib/actions/trending-searches.ts                  (new)
components/admin/AdminSidebar.tsx                 (modified — 3 new nav items)
lib/actions/banners.ts                            (new)
```
