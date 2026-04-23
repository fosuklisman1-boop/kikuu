# Promo Cards — Admin-Editable Homepage Promotional Banners

## Goal

Replace the hardcoded "Free Delivery in Accra" promo card on the homepage with admin-managed promo cards: multiple cards, fully editable content and styling, each optionally linked to a coupon from the coupons table.

## Architecture

A new `promo_cards` table stores card content. The homepage fetches active cards server-side and renders them in a responsive grid. The existing `/admin/banner` page gains a "Promo Cards" section for CRUD management. No client-side fetch on the homepage — server component reads directly from DB at render time.

## Tech Stack

- Next.js 15 App Router (server components for homepage fetch)
- Supabase (new `promo_cards` table, RLS matching existing pattern)
- React (admin form component, reuses existing admin UI patterns)

---

## Data Layer

### New table: `public.promo_cards`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `heading` | text | not null | e.g. "Free Delivery in Accra" |
| `subtext` | text | nullable | Body copy below heading |
| `badge_text` | text | nullable | Small pill label, e.g. "Limited Time Offer" |
| `cta_text` | text | nullable | Button label, e.g. "Shop Now" |
| `cta_link` | text | nullable | Button URL, e.g. "/products" |
| `color_theme` | text | not null, default `'amber'` | One of: `amber`, `green`, `blue`, `purple`, `red` |
| `coupon_id` | uuid | FK → `coupons(id)` on delete set null, nullable | Linked coupon |
| `sort_order` | int | not null, default 0 | Display order (ascending) |
| `active` | boolean | not null, default true | Hidden when false |
| `created_at` | timestamptz | not null, default `now()` | |

RLS:
- Public `SELECT` on rows where `active = true`
- Admin full access via `is_admin()`

### Color theme mapping (frontend)

| Theme | Gradient | Accent |
|---|---|---|
| `amber` | `from-[#fdf3e3] via-[#faecd8] to-[#f5d5a0]` | `#b45309` |
| `green` | `from-[#f0fdf4] via-[#dcfce7] to-[#bbf7d0]` | `#15803d` |
| `blue` | `from-[#eff6ff] via-[#dbeafe] to-[#bfdbfe]` | `#1d4ed8` |
| `purple` | `from-[#faf5ff] via-[#ede9fe] to-[#ddd6fe]` | `#7c3aed` |
| `red` | `from-[#fff1f2] via-[#ffe4e6] to-[#fecdd3]` | `#be123c` |

---

## Admin UI

### Location
Extend `/admin/banner` page (`app/admin/banner/page.tsx` + `components/admin/BannerManager.tsx`) with a new "Promo Cards" section below the existing hero carousel section.

### List view
- Table/list of cards: heading, color swatch, linked coupon code (or "—"), active toggle, Edit + Delete buttons
- "Add Promo Card" button at top of section
- Inline active toggle calls a server action to flip `active`

### Form (add/edit)
Fields (all in one page/modal form):
- **Heading** — text input, required
- **Subtext** — textarea, optional
- **Badge Text** — text input, optional (leave blank to hide the pill)
- **CTA Text** — text input, optional
- **CTA Link** — text input, optional
- **Color Theme** — swatch picker: 5 colored circles, click to select
- **Coupon** — dropdown of active coupons, format: `ACCRA200 — Free Shipping` / `SAVE10 — 10% off (GHS 10)` / `SUMMER — 15%`. First option is "None (no coupon code shown)"
- **Sort Order** — number input, default 0
- **Active** — toggle

### Server actions (`lib/actions/promo-cards.ts`)
- `getPromoCards()` — fetch all cards with joined coupon code for admin list
- `createPromoCard(data)` — insert + revalidate
- `updatePromoCard(id, data)` — update + revalidate
- `deletePromoCard(id)` — delete + revalidate
- `togglePromoCard(id, active)` — flip active + revalidate

All revalidate `/` and `/admin/banner`.

---

## Homepage

### Data fetch (`app/(store)/page.tsx`)
Add to the existing parallel `Promise.all` fetch:
```ts
admin.from('promo_cards')
  .select('*, coupons(code, type, value)')
  .eq('active', true)
  .order('sort_order')
```

### Rendering
- If `promoCards` is empty or null: render nothing (remove the section entirely — no gap)
- If cards present: render a responsive grid
  - 1 column on mobile, 2 columns on `md+`
  - Each card styled with its `color_theme` gradient and accent color
  - Badge pill shown if `badge_text` is set
  - Coupon code pill shown if `coupon_id` is set (reads `coupons.code` from join)
  - CTA button shown if `cta_text` and `cta_link` are set

### Migration seed
The migration seeds one card matching the current hardcoded card:
- heading: "Free Delivery in Accra"
- subtext: "On all orders over GHS 200. Use code below."
- badge_text: "Limited Time Offer"
- cta_text: "Shop Now"
- cta_link: "/products"
- color_theme: "amber"
- coupon_id: null (admin links it to ACCRA200 manually after the coupon is created, to avoid FK failure if coupon doesn't exist yet)

After migration runs, the hardcoded promo banner block in `page.tsx` is removed and replaced by the dynamic render.

---

## File Changes

| File | Action |
|---|---|
| `supabase/migrations/011_promo_cards.sql` | Create `promo_cards` table, RLS, seed row |
| `lib/actions/promo-cards.ts` | New — server actions for CRUD |
| `components/admin/PromoCardForm.tsx` | New — add/edit form |
| `components/admin/BannerManager.tsx` | Modify — add Promo Cards section |
| `app/admin/banner/page.tsx` | Modify — fetch promo cards + pass to BannerManager |
| `app/(store)/page.tsx` | Modify — fetch + render promo cards, remove hardcoded block |
