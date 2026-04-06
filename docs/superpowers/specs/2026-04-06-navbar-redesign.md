# Navbar Redesign Spec
**Date:** 2026-04-06
**Scope:** `components/store/Navbar.tsx`, `app/(store)/layout.tsx`

---

## Overview

Replace the current single-row navbar with a two-row desktop header and a persistent bottom tab bar on mobile. The change gives each element (logo, search, account, category navigation) dedicated space and aligns with the Jumia-style marketplace pattern familiar to Ghanaian shoppers.

---

## Desktop Layout (≥ 768px)

### Row 1 — Identity + Search + Account
Full-width sticky header row, `h-14`, `bg-[#fafaf8]/95 backdrop-blur-sm border-b border-[#ede8df]`.

| Zone | Content |
|---|---|
| Left | Logo icon + "Kikuu" wordmark |
| Center | Search bar (flex-1, max-w-xl) with amber Search button — same as current |
| Right | Wishlist icon + label, Cart icon + badge + label, Sign In button / User avatar dropdown |

Wishlist and Cart get a stacked label below the icon (like Jumia desktop) so the zone reads clearly without hover tooltips.

### Row 2 — Category Navigation
Second sticky row, `h-10`, `bg-white border-b border-[#ede8df]`, sits directly below Row 1.

Left anchor: **"☰ All Categories"** button — `bg-[#0a0a0a] text-white` rounded pill. Click toggles the mega menu.

Separator, then inline links: **Deals** (amber active style) · **New Arrivals** · **Pre-orders**. These are static routes, not DB-driven.

### Mega Menu
Triggered by clicking "All Categories". Renders as a full-width panel below Row 2, `bg-white border-b border-[#ede8df] shadow-lg z-40`.

- Categories fetched from Supabase (`parent_id IS NULL`, ordered by `sort_order`) — passed as a prop from the layout or fetched client-side on first open
- Subcategories fetched in a second query (`parent_id = category.id`) — or included via a joined query
- Layout: 4-column CSS grid (`grid-cols-4`). Each column = one parent category with its name (amber, bold), subcategory links below, and a "See all →" link to `/products?category=slug`
- Closes on: outside click, Escape key, route change
- Animation: `AnimatePresence` fade + slide down (`y: -8 → 0`, opacity 0 → 1, 150ms)

---

## Mobile Layout (< 768px)

### Simplified Header
Single row, `h-14`. Contains: Logo icon · Search bar (flex-1) · Cart icon with badge. Wishlist and account links move to the bottom tab bar. No hamburger menu.

### Bottom Tab Bar
Fixed to the bottom of the viewport, `h-16`, `bg-white border-t border-[#ede8df]`, `safe-area-inset-bottom` padding for iOS notch support.

Five tabs, equal width, icon + label stacked:

| Tab | Icon | Route |
|---|---|---|
| Home | `Home` | `/` |
| Categories | `LayoutGrid` | — opens category overlay |
| Deals | `Zap` | `/products?sort=discount` |
| Wishlist | `Heart` | `/account/wishlist` |
| Account | `User` | `/account` or `/account/login` |

Active tab: icon and label in `text-[#b45309]`. Inactive: `text-[#a89e96]`.

Cart badge on mobile lives on the Cart icon in the header (not in the tab bar, to keep tab bar uncluttered).

### Mobile Category Overlay
Tapping the Categories tab opens a full-screen slide-up overlay (`fixed inset-0 z-50 bg-white`). Contains the same category grid as the desktop mega menu, but as a scrollable vertical list. Close button (X) top-right. Animated with `AnimatePresence` slide from bottom.

---

## Component Changes

| File | Change |
|---|---|
| `components/store/Navbar.tsx` | Full rewrite — split into subcomponents |
| `components/store/NavbarRow1.tsx` | New — logo + search + account (desktop) |
| `components/store/NavbarRow2.tsx` | New — category nav + mega menu trigger |
| `components/store/MegaMenu.tsx` | New — full-width category mega menu panel |
| `components/store/BottomTabBar.tsx` | New — mobile bottom navigation |
| `components/store/MobileCategoryOverlay.tsx` | New — full-screen category sheet for mobile |
| `app/(store)/layout.tsx` | Add `<BottomTabBar />` below `<main>`, add `pb-16 md:pb-0` to `<main>` to avoid overlap |

`Navbar.tsx` becomes the orchestrator that renders Row1 + Row2 on desktop and the simplified header on mobile. The bottom tab bar is rendered in `layout.tsx` separately so it sits outside the scroll container.

---

## Data Flow

Categories for the mega menu are needed client-side (user can open it at any time). Two options:

1. **Prop-drill from layout (preferred):** Fetch categories server-side in `app/(store)/layout.tsx`, pass to `Navbar` as a prop. Zero client-side fetch, instant open.
2. **Client fetch on first open:** Fetch from Supabase client on first "All Categories" click, cache in component state. Adds ~100ms latency on first open.

**Decision: Option 1** — layout already imports Navbar; adding a server fetch there keeps the mega menu instant.

Subcategories: fetch all categories in one query (no `parent_id` filter), then group client-side — categories where `parent_id IS NULL` are parents; the rest are children. Group children by `parent_id` into a `Map<string, Category[]>` to render under each parent column.

---

## Error Handling

- If categories fail to load: mega menu shows "Browse all products →" fallback link only. No error toast — silent degradation.
- If user is not authenticated and taps Wishlist/Account tab: redirect to `/account/login?redirect=<current-path>`.

---

## Behaviour Notes

- Sticky behaviour: both rows sticky together (`sticky top-0`). The header is a single `<header>` element containing both rows so they scroll as one unit.
- `z-index` stack: header `z-50`, mega menu `z-40`, bottom tab bar `z-50`.
- The bottom tab bar must not overlap page content — `<main>` gets `pb-16 md:pb-0`.
- Mega menu closes on `router` navigation (use `usePathname` effect).

---

## Out of Scope

- Search autocomplete / suggestions dropdown (separate feature)
- Notification bell
- Language/currency switcher
- Admin navbar (unchanged)
