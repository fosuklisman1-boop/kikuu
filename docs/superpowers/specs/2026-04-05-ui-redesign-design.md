# Kikuu UI Redesign — Design Spec
**Date:** 2026-04-05
**Scope:** Customer-facing store only (admin panel excluded)

---

## 1. Design System

### Color Palette
| Token | Value | Usage |
|---|---|---|
| `--color-accent` | `#b45309` | Buttons, prices, badges, links, active states |
| `--color-accent-light` | `#fdf6ec` | Card image backgrounds, hover fills |
| `--color-accent-mid` | `#faecd8` | Gradient endpoints, banner backgrounds |
| `--color-base` | `#fafaf8` | Page background |
| `--color-surface` | `#ffffff` | Cards, modals, dropdowns |
| `--color-border` | `#ede8df` | Card borders, dividers |
| `--color-text-primary` | `#0a0a0a` | Headings, product names |
| `--color-text-secondary` | `#6b6360` | Labels, descriptions |
| `--color-text-muted` | `#a89e96` | Metadata, timestamps, secondary prices |

No green remains in the customer-facing UI. Amber is the single accent throughout.

### Typography
- **Font:** DM Sans (Google Fonts) — weights 400, 500, 600, 700, 800
- **Headings:** 800 weight, tight letter-spacing (`-0.03em` to `-0.05em`)
- **Labels:** 700 weight, `letter-spacing: 0.12em`, `text-transform: uppercase`, `font-size: 0.65rem`
- **Body:** 400–500 weight, `line-height: 1.6`
- Replace current Geist font with DM Sans globally via `app/layout.tsx`

### Spacing & Shape
- Border radius: `12px` cards, `8px` buttons/inputs, `20px` pills/badges
- Consistent `24px` / `32px` section padding rhythm
- Shadows: `0 4px 24px rgba(0,0,0,0.08)` for cards, `0 1px 4px rgba(0,0,0,0.06)` for inputs

---

## 2. Component Changes

### Navbar
- Background: `#fafaf8` (always light, no green — remove scroll color-change behavior)
- Logo: amber square icon + "Kikuu" in DM Sans 800
- Search bar: white with `--color-border` border, amber focus ring
- "Sign In" button: solid amber
- Cart badge: amber background (keep existing Framer Motion animation)
- Remove: green background, white-on-green scroll transition

### AnnouncementBar
- Background: `#0a0a0a` (near-black strip)
- Text: `#fdf6ec` (warm white)
- Accent words: `#b45309`
- Keep scrolling animation

### Hero Banner (HeroBanner.tsx — full rewrite)
- Layout: full-width amber gradient (`#fdf3e3` → `#faecd8` → `#f5d5a0`)
- Left side: label + headline + subtext + 2 CTAs + trust badges
- Right side: floating product card with drop shadow
- Primary CTA: "Shop Deals" — dark `#0a0a0a` background, white text
- Secondary CTA: outlined amber border
- Remove: animated blobs, dot grid, diagonal lines, glassmorphism floating cards
- Keep: scroll-triggered fade-in animation (simplified)
- Stats strip below hero: white cards with amber numbers

### CategoryGrid
- Cards: white, `border: 1px solid --color-border`, hover lifts with shadow
- Icon/image area: amber-tinted background (`--color-accent-light`)
- Category name: DM Sans 700, `#0a0a0a`
- Remove: current gradient bg cards

### ProductCard (full rewrite)
- Background: white, `border-radius: 16px`, `box-shadow: 0 4px 24px rgba(0,0,0,0.08)`
- Image area: gradient `#fdf6ec → #faecd8`, `border-radius: 12px 12px 0 0`
- Wishlist heart: white circle pill, top-right, amber on active
- Discount badge: amber solid, top-left
- Price: amber `#b45309`, 800 weight
- Compare-at price: muted strikethrough
- CTA: full-width "Add to Cart" button, amber bg, white text, `border-radius: 8px`
- Hover: card lifts `translateY(-4px)`, shadow deepens
- Stock warning (`≤5 left`): amber text, no red

### Footer
- Background: `#0a0a0a`
- Text: warm white `#fdf6ec` + muted `#6b6360`
- Accent links: amber on hover
- Remove: current green footer

### CheckoutForm
- Input focus: amber ring
- Section headings: DM Sans 700 uppercase label style
- "Place Order" button: full-width amber

### Cart, Account, Orders pages
- Consistent amber accent for buttons, totals, status badges
- White surfaces on `#fafaf8` background
- Remove all remaining green

---

## 3. Homepage Layout (app/(store)/page.tsx)

Section order (unchanged):
1. AnnouncementBar
2. Navbar
3. **Hero** — amber gradient, redesigned
4. **Categories** — clean grid, amber-tinted image areas
5. **Why Kikuu** — 4 feature cards, white on `#f5f2ed` strip
6. **Promo Banner** — amber gradient (replace current yellow-orange gradient)
7. **Featured Products** — floating shadow cards
8. **Newsletter CTA** — near-black background, amber CTA
9. **Payment Methods strip** — white bg, amber-styled badges
10. Footer

---

## 4. Animations (refined, not removed)

- Keep Framer Motion throughout
- Remove: blob animations, glassmorphism, heavy parallax
- Keep: fade-up on scroll (`AnimateIn`), stagger on product grids, cart badge spring, navbar entrance
- Add: card hover lift (`whileHover: { y: -4 }`) on ProductCard and CategoryGrid

---

## 5. Out of Scope

- Admin panel (`/admin/*`) — no changes
- Database schema — no changes
- API routes — no changes
- Auth flow logic — no changes
- Mobile navigation structure — responsive but same structure

---

## 6. Implementation Order

1. Add DM Sans to `app/layout.tsx`, set CSS variables in `app/globals.css`
2. Navbar — remove green, apply amber
3. HeroBanner — full rewrite
4. ProductCard — full rewrite
5. CategoryGrid — update colors
6. Footer — dark bg rewrite
7. AnnouncementBar — dark strip
8. Homepage sections (Why Kikuu, Promo Banner, Newsletter, Payment strip)
9. CheckoutForm, Cart, Account pages — accent color sweep
