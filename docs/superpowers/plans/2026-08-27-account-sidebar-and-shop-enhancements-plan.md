# Account Sidebar & Shop Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the navbar's profile dropdown with a slide-out sidebar, give the seller dashboard real stat cards, let shop owners add products to their shop while browsing the main site, and let shops sell pre-order products with earnings deferred until the admin marks the order delivered.

**Architecture:** Five independent tasks, each touching a disjoint set of files. The first three are UI/read-only additions reusing existing server actions. The fourth relaxes three query filters that currently exclude pre-order products from shop surfaces. The fifth — the only one touching money-movement logic — adds one guard condition to the existing earnings-crediting function and one new call site at order delivery.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), Zod, Vitest, framer-motion, lucide-react — unchanged.

**Spec:** [docs/superpowers/specs/2026-08-27-account-sidebar-and-shop-enhancements-design.md](../specs/2026-08-27-account-sidebar-and-shop-enhancements-design.md)

## Global Constraints

- Every server action derives its scope via `requireShopOwner()` or `requireAdmin()` — never accept a client-supplied `shopId`.
- `lib/wallet-ledger.ts` stays a plain module (no `'use server'` directive) — it already is; do not add one.
- Any task touching a `'use server'` file requires a real `npm run build`, not just `tsc --noEmit` — this project had a real production incident invisible to `tsc`/Vitest alike.
- No database migration in this plan — every change reuses existing columns, views, and constraints.
- This codebase does not unit-test React components or Supabase-admin-client-touching server functions (confirmed: no `.test.tsx` files exist, and `lib/wallet-ledger.ts`/`lib/actions/shop-products.ts` have no existing test files). Follow that convention — verify UI and DB-touching tasks via `tsc`, a real `npm run build`, `eslint`, and manual reasoning/dev-server checks, not new mocked unit tests. Pure-function logic (already existing, e.g. `computeOrderEarnings`, `computeShopPrice`) keeps its existing Vitest coverage; this plan adds no pure functions that need new tests.

---

### Task 1: Profile Sidebar

**Files:**
- Create: `components/store/ProfileSidebar.tsx`
- Modify: `components/store/NavbarRow1.tsx`

**Interfaces:**
- Produces: `ProfileSidebar` component, props `{ displayName: string; email: string; initials: string; wishlistCount: number; shopHref: string; shopLabel: string; open: boolean; onClose: () => void }`.
- Consumes: nothing from other tasks in this plan.

- [ ] **Step 1: Read the current files in full**

Read `components/store/NavbarRow1.tsx` and `components/seller/SellerSidebar.tsx` (the drawer pattern this task replicates) in full before editing.

- [ ] **Step 2: Create `components/store/ProfileSidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { LayoutDashboard, Package, Heart, User, LogOut, Store, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const NAV = [
  { href: '/account', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/account/orders', label: 'My Orders', icon: Package },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/profile', label: 'Profile & Addresses', icon: User },
]

interface ProfileSidebarProps {
  displayName: string
  email: string
  initials: string
  wishlistCount: number
  shopHref: string
  shopLabel: string
  open: boolean
  onClose: () => void
}

export default function ProfileSidebar({
  displayName,
  email,
  initials,
  wishlistCount,
  shopHref,
  shopLabel,
  open,
  onClose,
}: ProfileSidebarProps) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    onClose()
    router.push('/')
    router.refresh()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/40"
          />
          <motion.aside
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed top-0 right-0 bottom-0 z-[60] w-80 max-w-[85vw] bg-[#fafaf8] flex flex-col shadow-2xl"
          >
            <div className="px-5 py-5 border-b border-[#ede8df] flex items-center gap-3 shrink-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#b45309] to-[#92400e] flex items-center justify-center text-white font-extrabold text-sm shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#0a0a0a] text-sm truncate">{displayName}</p>
                <p className="text-xs text-[#a89e96] truncate">{email}</p>
              </div>
              <button onClick={onClose} className="text-[#a89e96] hover:text-[#0a0a0a] p-1 rounded-lg transition-colors" aria-label="Close menu">
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto">
              {NAV.map(({ href, label, icon: Icon }) => {
                const badge = label === 'Wishlist' && wishlistCount > 0 ? wishlistCount : null
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-[#6b6360] hover:bg-[#fdf6ec] hover:text-[#b45309] transition-colors border-b border-[#f5f0e8]"
                  >
                    <Icon size={17} className="text-[#a89e96]" />
                    <span className="flex-1">{label}</span>
                    {badge && (
                      <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </Link>
                )
              })}
              <Link
                href={shopHref}
                onClick={onClose}
                className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-[#b45309] hover:bg-[#fdf6ec] transition-colors border-b border-[#f5f0e8]"
              >
                <Store size={17} className="text-[#b45309]" />
                {shopLabel}
              </Link>
            </nav>

            <div className="p-3 border-t border-[#ede8df] shrink-0">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 3: Modify `components/store/NavbarRow1.tsx`**

Change the imports: remove `ChevronDown, Package, LayoutDashboard, LogOut` from the `lucide-react` import (no longer used directly in this file — `ProfileSidebar` owns its own icons) but keep `User, ShoppingCart, Heart`. Remove the `useRef` import if no longer used elsewhere in the file (check first — it's currently only used for `userMenuRef`). Add:

```ts
import ProfileSidebar from '@/components/store/ProfileSidebar'
import { getMyShop } from '@/lib/actions/shops'
import { shopUrl } from '@/lib/shop-url'
```

Remove the `userMenuRef` (`useRef<HTMLDivElement>(null)`) and its associated `useEffect` (the mousedown/click-outside listener, lines 42-50 in the current file) — the drawer's own backdrop click now handles closing.

Add state for shop info, alongside the existing `user` state:

```ts
const [shop, setShop] = useState<{ slug: string } | null>(null)
```

In the existing `useEffect` that calls `supabase.auth.getUser()`, after setting the user, also fetch shop ownership (only when there is a user):

```ts
useEffect(() => {
  const supabase = createClient()
  supabase.auth.getUser().then(({ data }) => setUser(data.user))
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
    setUser(session?.user ?? null)
  })
  return () => subscription.unsubscribe()
}, [])

useEffect(() => {
  if (!user) {
    setShop(null)
    return
  }
  getMyShop().then((s) => setShop(s ? { slug: s.slug } : null))
}, [user])
```

Replace the entire "User" block (the `{user ? (...) : (...)}` conditional currently rendering the avatar button + `AnimatePresence`/dropdown, roughly lines 130-202 of the current file) with:

```tsx
{user ? (
  <button
    onClick={() => setUserMenuOpen(true)}
    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#fdf6ec] transition-colors"
  >
    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#b45309] to-[#92400e] flex items-center justify-center text-white text-xs font-extrabold">
      {initials}
    </div>
    <div className="flex flex-col items-start">
      <span className="text-[10px] text-[#a89e96] leading-none">Hello,</span>
      <span className="text-xs font-semibold text-[#0a0a0a] max-w-[72px] truncate leading-tight">
        {displayName.split(' ')[0]}
      </span>
    </div>
  </button>
) : (
  <Link href="/account/login">
    <motion.div
      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
      className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl cursor-pointer text-[#6b6360] hover:bg-[#fdf6ec] transition-colors"
    >
      <User size={18} />
      <span className="text-[10px] font-medium">Sign In</span>
    </motion.div>
  </Link>
)}
```

Note the `ChevronDown` icon and its rotate-on-open styling are dropped entirely (no longer meaningful once this opens a drawer instead of an anchored popup).

After the closing `</div>` of the outer navbar row (just before the final closing `</div>` of the component's returned JSX), render the sidebar itself, outside the row's layout flow:

```tsx
{user && (
  <ProfileSidebar
    displayName={displayName}
    email={user.email ?? ''}
    initials={initials}
    wishlistCount={wishlistCount}
    shopHref={shop ? '/seller/dashboard' : '/seller/onboarding'}
    shopLabel={shop ? 'My Shop' : 'Sell on Kikuu'}
    open={userMenuOpen}
    onClose={() => setUserMenuOpen(false)}
  />
)}
```

`userMenuOpen` state, `displayName`, `initials`, and `wishlistCount` (from the existing `useWishlist()` hook already called at the top of the file as `count: wishlistCount`) already exist in this file — reuse them, don't redeclare.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Run eslint**

Run: `npx eslint components/store/ProfileSidebar.tsx components/store/NavbarRow1.tsx`
Expected: no errors (an `react-hooks/exhaustive-deps` warning on the new shop-fetching effect is expected and fine, matching the existing pattern already used elsewhere in this file — check the existing effects for the same suppression style before deciding whether to add `// eslint-disable-next-line`).

- [ ] **Step 6: Manual verification with `npm run dev`**

Log in as a regular user, click the avatar in the desktop navbar: confirm the drawer slides in from the right with the backdrop, shows the correct name/email/initials, all four nav links navigate correctly and close the drawer, the wishlist badge shows when count > 0, "My Shop"/"Sell on Kikuu" shows the correct label and link depending on whether the test account owns a shop, Sign Out works, and clicking the backdrop or the X closes the drawer without navigating. Confirm mobile is unaffected (no navbar avatar/dropdown was ever shown there).

- [ ] **Step 7: Commit**

```bash
git add components/store/ProfileSidebar.tsx components/store/NavbarRow1.tsx
git commit -m "feat: replace navbar profile dropdown with a slide-out sidebar"
```

---

### Task 2: Dashboard Stat Cards

**Files:**
- Modify: `lib/actions/shop-products.ts`
- Modify: `app/seller/(shop)/dashboard/page.tsx`

**Interfaces:**
- Produces: `getShopOrderStats(): Promise<{ total: number; pending: number }>`, exported from `lib/actions/shop-products.ts`.
- Consumes: `getWalletBalance()`, `getWithdrawableBalance()` (already exist in `lib/actions/wallet.ts`).

- [ ] **Step 1: Read the current files in full**

Read `lib/actions/shop-products.ts` and `app/seller/(shop)/dashboard/page.tsx` in full first.

- [ ] **Step 2: Add `getShopOrderStats` to `lib/actions/shop-products.ts`**

Add this function at the end of the file (after `getShopProductsPriced`):

```ts
export async function getShopOrderStats(): Promise<{ total: number; pending: number }> {
  const { shopId } = await requireShopOwner()
  const admin = createAdminClient()
  const [{ count: total }, { count: pending }] = await Promise.all([
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('shop_id', shopId)
      .in('status', ['pending', 'paid', 'processing', 'shipped']),
  ])
  return { total: total ?? 0, pending: pending ?? 0 }
}
```

No new imports needed — `requireShopOwner` and `createAdminClient` are already imported in this file.

- [ ] **Step 3: Modify `app/seller/(shop)/dashboard/page.tsx`**

Change the imports to add the new data sources and icons:

```ts
import { getMyShop } from '@/lib/actions/shops'
import { getShopProductsPriced, getShopOrderStats } from '@/lib/actions/shop-products'
import { getWalletBalance, getWithdrawableBalance } from '@/lib/actions/wallet'
import Link from 'next/link'
import { shopUrl } from '@/lib/shop-url'
import { Wallet, PiggyBank, ShoppingBag, Clock } from 'lucide-react'
import { formatGHS } from '@/lib/utils'
```

Change the data fetching to run in parallel:

```ts
export default async function SellerDashboardPage() {
  const shop = await getMyShop()
  if (!shop) return null // layout already redirects if there's no shop; this satisfies TypeScript

  const [products, walletBalance, withdrawable, orderStats] = await Promise.all([
    getShopProductsPriced(),
    getWalletBalance(),
    getWithdrawableBalance(),
    getShopOrderStats(),
  ])
```

Replace the existing single-card `<div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">...</div>` block with four cards:

```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
    <div className="flex items-center gap-2 mb-1">
      <Wallet size={14} className="text-gray-400" />
      <p className="text-xs text-gray-400 uppercase tracking-wide">Wallet Balance</p>
    </div>
    <p className="text-2xl font-bold text-gray-900">{formatGHS(walletBalance)}</p>
  </div>
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
    <div className="flex items-center gap-2 mb-1">
      <PiggyBank size={14} className="text-gray-400" />
      <p className="text-xs text-gray-400 uppercase tracking-wide">Withdrawable Now</p>
    </div>
    <p className="text-2xl font-bold text-gray-900">{formatGHS(withdrawable)}</p>
  </div>
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
    <div className="flex items-center gap-2 mb-1">
      <ShoppingBag size={14} className="text-gray-400" />
      <p className="text-xs text-gray-400 uppercase tracking-wide">Total Orders</p>
    </div>
    <p className="text-2xl font-bold text-gray-900">{orderStats.total}</p>
  </div>
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
    <div className="flex items-center gap-2 mb-1">
      <Clock size={14} className="text-gray-400" />
      <p className="text-xs text-gray-400 uppercase tracking-wide">Pending Orders</p>
    </div>
    <p className="text-2xl font-bold text-gray-900">{orderStats.pending}</p>
  </div>
</div>
```

Keep the "Products in shop" figure — add it as a fifth small line under the shop name/URL area, or fold it into the grid as a fifth card (`sm:grid-cols-5`) — pick whichever reads cleaner once you see it rendered; either is acceptable, just don't drop the figure entirely. Use `products.length` exactly as the current code already does.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Run a real production build**

Run: `npm run build`
Expected: succeeds — this task adds a new export to `lib/actions/shop-products.ts`, a `'use server'` file; confirm the new export is an `async function` (it is) and nothing non-function got exported alongside it.

- [ ] **Step 6: Manual verification**

With `npm run dev`, log in as a seller with at least one order (if none exist in the dev database, verify the zero-state renders sensibly — `0` for orders, `GHS 0.00` for balances — rather than crashing). Confirm all four (or five) cards render with correct values matching what `/seller/wallet` already shows for balance figures.

- [ ] **Step 7: Commit**

```bash
git add lib/actions/shop-products.ts "app/seller/(shop)/dashboard/page.tsx"
git commit -m "feat: add wallet and order stat cards to the seller dashboard"
```

---

### Task 3: Add-to-Shop While Browsing

**Files:**
- Create: `components/store/AddToShopButton.tsx`
- Modify: `components/store/ProductCard.tsx`
- Modify: `app/(store)/products/page.tsx`
- Modify: `app/(store)/products/[slug]/page.tsx`

**Interfaces:**
- Produces: `AddToShopButton` component, props `{ productId: string; basePrice: number }`.
- Consumes: `addShopProducts` (already exists in `lib/actions/shop-products.ts`), `MarkupForm` (already exists in `components/seller/MarkupForm.tsx`), `getMyShop` (already exists in `lib/actions/shops.ts`).

- [ ] **Step 1: Read the current files in full**

Read `components/store/ProductCard.tsx`, `components/seller/MarkupForm.tsx`, `app/(store)/products/page.tsx`, and `app/(store)/products/[slug]/page.tsx` in full first.

- [ ] **Step 2: Create `components/store/AddToShopButton.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Store } from 'lucide-react'
import { addShopProducts } from '@/lib/actions/shop-products'
import MarkupForm from '@/components/seller/MarkupForm'

export default function AddToShopButton({ productId, basePrice }: { productId: string; basePrice: number }) {
  const [open, setOpen] = useState(false)
  const [markupType, setMarkupType] = useState<'flat' | 'percentage'>('flat')
  const [markupValue, setMarkupValue] = useState(0)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMessage('')
    startTransition(async () => {
      const result = await addShopProducts({ productIds: [productId], markupType, markupValue })
      if (result.error) {
        setMessage(result.error)
      } else {
        setMessage('Added to your shop!')
        setTimeout(() => { setOpen(false); setMessage('') }, 1500)
      }
    })
  }

  return (
    <div className="relative" onClick={(e) => e.preventDefault()}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v) }}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow-sm text-[#6b6360] hover:text-[#b45309] transition-colors"
        aria-label="Add to my shop"
        title="Add to my shop"
      >
        <Store size={15} />
      </button>

      {open && (
        <div
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-30"
        >
          <p className="text-xs font-semibold text-gray-700 mb-2">Add to my shop</p>
          <MarkupForm
            basePrice={basePrice}
            initialMarkupType={markupType}
            initialMarkupValue={markupValue}
            onChange={(type, value) => { setMarkupType(type); setMarkupValue(value) }}
          />
          <button
            onClick={handleAdd}
            disabled={pending}
            className="mt-2 w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
          >
            {pending ? 'Adding…' : 'Add'}
          </button>
          {message && <p className="mt-2 text-xs text-gray-600">{message}</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Modify `components/store/ProductCard.tsx`**

Add to the props: `hasShop?: boolean`, defaulting to `false`. Add the import:

```ts
import AddToShopButton from './AddToShopButton'
```

Change the component signature from `export default function ProductCard({ product, salePrice }: { product: Product; salePrice?: number }) {` to:

```ts
export default function ProductCard({ product, salePrice, hasShop = false }: { product: Product; salePrice?: number; hasShop?: boolean }) {
```

Render `<AddToShopButton productId={product.id} basePrice={displayPrice} />` conditionally when `hasShop` is true, positioned near the existing wishlist heart button (both are small icon-buttons overlaid on the product image) — read the current file's wishlist button JSX to match its exact positioning classes (likely `absolute top-2 right-2` or similar) and place the new button so the two don't overlap, e.g. stacked vertically or side by side depending on the existing layout. Wrap it so its own click handlers (which already call `e.preventDefault()`/`e.stopPropagation()`) don't trigger the card's outer `<Link>` navigation:

```tsx
{hasShop && (
  <div className="absolute top-2 left-2 z-10">
    <AddToShopButton productId={product.id} basePrice={displayPrice} />
  </div>
)}
```

Adjust the exact position classes once you see the wishlist button's actual current placement — the two must not overlap.

- [ ] **Step 4: Modify `app/(store)/products/page.tsx`**

Add the import:

```ts
import { getMyShop } from '@/lib/actions/shops'
```

In the `Promise.all` that fetches `products`, `categories`, `trendingSearches`, etc., add `getMyShop()` as one more parallel call, and derive `hasShop` from its result:

```ts
const [
  { data: products, count: tabCount },
  { count: availableCount },
  { count: preorderCount },
  { data: categories },
  { data: trendingSearches },
  shop,
] = await Promise.all([
  buildQuery(activeStatus).range(from, from + PAGE_SIZE - 1),
  buildQuery('active'),
  buildQuery('pre_order'),
  supabase.from('categories').select('*').is('parent_id', null).order('sort_order'),
  supabase.from('trending_searches').select('*').eq('active', true).order('sort_order').limit(8),
  getMyShop(),
])
const hasShop = !!shop
```

Find where `<ProductCard ... />` is rendered in this file's JSX (inside the products grid) and add `hasShop={hasShop}` to its props.

- [ ] **Step 5: Modify `app/(store)/products/[slug]/page.tsx`**

Add the import:

```ts
import { getMyShop } from '@/lib/actions/shops'
import AddToShopButton from '@/components/store/AddToShopButton'
```

After the existing `const salePrices = await getFlashSalePriceMap([product.id])` line, add:

```ts
const shop = await getMyShop()
```

In the JSX, near the stock/pre-order badge block (the `<div className="mb-6">...</div>` containing the in-stock/pre-order status), add the button when a shop exists:

```tsx
{shop && (
  <div className="mb-4">
    <AddToShopButton productId={product.id} basePrice={displayPrice} />
  </div>
)}
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Run a real production build**

Run: `npm run build`
Expected: succeeds. `AddToShopButton.tsx` is a Client Component importing `addShopProducts` (a `'use server'` export) — Next.js handles this natively (calling a server action from a client component is supported directly, not just via form actions), but the build is the check that proves it end-to-end.

- [ ] **Step 8: Run eslint**

Run: `npx eslint components/store/AddToShopButton.tsx components/store/ProductCard.tsx "app/(store)/products/page.tsx" "app/(store)/products/[slug]/page.tsx"`
Expected: no new errors.

- [ ] **Step 9: Manual verification**

With `npm run dev`, log in as a user who owns a shop: confirm the storefront icon appears on product cards in `/products` and on individual product pages, clicking it opens the markup popover, submitting adds the product (verify by checking `/seller/products`'s Manage tab afterward), and the popover doesn't trigger navigation to the product page. Log in as (or view as) a user without a shop: confirm the icon does not appear anywhere. Confirm the homepage (`/`) is unaffected (its `ProductCard` usage doesn't pass `hasShop`, so it defaults to `false` — icon never shows there in this plan's scope).

- [ ] **Step 10: Commit**

```bash
git add components/store/AddToShopButton.tsx components/store/ProductCard.tsx "app/(store)/products/page.tsx" "app/(store)/products/[slug]/page.tsx"
git commit -m "feat: let shop owners add products to their shop while browsing"
```

---

### Task 4: Pre-order Products in Shops

**Files:**
- Modify: `app/seller/(shop)/products/page.tsx`
- Modify: `app/(store)/shop/[slug]/page.tsx`
- Modify: `app/(store)/shop/[slug]/[productSlug]/page.tsx`
- Modify: `components/store/ShopProductCard.tsx`
- Modify: `components/seller/ShopProductPicker.tsx`

**Interfaces:**
- Consumes: nothing from other tasks in this plan.
- Produces: nothing other tasks in this plan depend on.

- [ ] **Step 1: Read the current files in full**

Read all five files listed above in full before editing. Also read `app/(store)/products/[slug]/page.tsx`'s pre-order badge JSX (lines 96-126 in the version read for Task 3) as the reference pattern to replicate — the "Pre-order" pill plus the orange info block with `CalendarClock` icon and `Expected delivery within N days` text.

- [ ] **Step 2: Relax the query filter in `app/seller/(shop)/products/page.tsx`**

Change:
```ts
supabase.from('products').select('*').eq('status', 'active').order('name'),
```
to:
```ts
supabase.from('products').select('*').in('status', ['active', 'pre_order']).order('name'),
```

- [ ] **Step 3: Relax the query filter in `app/(store)/shop/[slug]/page.tsx`**

Change:
```ts
? await supabase.from('products').select('*').in('id', productIds).eq('status', 'active')
```
to:
```ts
? await supabase.from('products').select('*').in('id', productIds).in('status', ['active', 'pre_order'])
```

- [ ] **Step 4: Relax the query filter in `app/(store)/shop/[slug]/[productSlug]/page.tsx`**

Change:
```ts
.eq('status', 'active')
.single() as { data: any }
```
to:
```ts
.in('status', ['active', 'pre_order'])
.single() as { data: any }
```

Add a pre-order badge and info block to this page's JSX, replacing the current plain stock-status block (`<div className="mb-6">...In Stock/Out of Stock...</div>`) with the same pattern `app/(store)/products/[slug]/page.tsx` already uses:

```tsx
import { CalendarClock } from 'lucide-react'
```

```tsx
<div className="mb-6">
  {isPreorder ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-orange-50 text-orange-700">
      <CalendarClock size={14} />
      Pre-order
    </span>
  ) : (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
      inStock ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
    }`}>
      {inStock ? `In Stock (${product.stock_qty} left)` : 'Out of Stock'}
    </span>
  )}
</div>

{isPreorder && product.preorder_days && (
  <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-6">
    <CalendarClock size={16} className="text-orange-500 shrink-0 mt-0.5" />
    <div>
      <p className="text-sm font-semibold text-orange-800">Pre-order Item</p>
      <p className="text-xs text-orange-600 mt-0.5">
        Expected delivery within {product.preorder_days} days of purchase.
      </p>
      {product.preorder_note && (
        <p className="text-xs text-orange-500 mt-0.5">{product.preorder_note}</p>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 5: Add a pre-order badge to `components/store/ShopProductCard.tsx`**

Add near the top of the component, alongside the existing `outOfStock` derivation:

```ts
const isPreorder = product.status === 'pre_order'
```

In the JSX, inside the image area (near where `outOfStock`'s "Out of Stock" overlay is rendered), add a small badge for the pre-order case — positioned so it doesn't collide with the out-of-stock overlay (they're mutually exclusive states given `outOfStock` is already `false` for pre-order products):

```tsx
{isPreorder && (
  <div className="absolute top-2 left-2 bg-orange-50 text-orange-700 text-[10px] font-semibold px-2 py-1 rounded-full border border-orange-200">
    Pre-order
  </div>
)}
```

- [ ] **Step 6: Add a pre-order badge to `components/seller/ShopProductPicker.tsx`**

In the product grid `<label>` cards, add a small badge matching the same pattern, derived the same way (`product.status === 'pre_order'`):

```tsx
{product.status === 'pre_order' && (
  <span className="absolute top-2 left-2 bg-orange-50 text-orange-700 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-orange-200">
    Pre-order
  </span>
)}
```

Place it inside the existing `<label>` block, positioned so it doesn't collide with the existing `<input type="checkbox">` (currently `absolute top-2 right-2`) — this badge goes on the opposite corner (`top-2 left-2`), so no collision.

- [ ] **Step 7: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Run a real production build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 9: Run eslint**

Run: `npx eslint "app/seller/(shop)/products/page.tsx" "app/(store)/shop/[slug]/page.tsx" "app/(store)/shop/[slug]/[productSlug]/page.tsx" components/store/ShopProductCard.tsx components/seller/ShopProductPicker.tsx`
Expected: no new errors.

- [ ] **Step 10: Manual verification**

With `npm run dev`, log in as a seller: confirm the Browse Catalog tab now shows pre-order products (with the pre-order badge) alongside active ones, and adding one to the shop works via the existing `addShopProducts` flow. Visit that shop's storefront as a shopper: confirm the pre-order product appears with its badge, is never shown as "Out of Stock," and its detail page shows the pre-order info block with the correct `preorder_days`/`preorder_note`. Add it to cart and confirm checkout completes normally (this exercises the already-existing, unmodified checkout pre-order logic).

- [ ] **Step 11: Commit**

```bash
git add "app/seller/(shop)/products/page.tsx" "app/(store)/shop/[slug]/page.tsx" "app/(store)/shop/[slug]/[productSlug]/page.tsx" components/store/ShopProductCard.tsx components/seller/ShopProductPicker.tsx
git commit -m "feat: allow pre-order products to be curated and sold through shops"
```

---

### Task 5: Delivery-Triggered Earnings for Pre-order Shop Orders

This task touches money-movement logic (`lib/wallet-ledger.ts`). Treat it with the same care this codebase applies to payment-code changes: read the current files in full, make only the described changes, and verify with a real build, not just `tsc`.

**Files:**
- Modify: `lib/wallet-ledger.ts`
- Modify: `lib/actions/products.ts`

**Interfaces:**
- Consumes: nothing from other tasks in this plan.
- Produces: nothing other tasks in this plan depend on. `creditShopEarnings`'s signature (`(orderId: string): Promise<void>`) is unchanged — only its internal logic gains one guard.

- [ ] **Step 1: Read the current files in full**

Read `lib/wallet-ledger.ts` and `lib/actions/products.ts` in full before editing.

- [ ] **Step 2: Modify `creditShopEarnings` in `lib/wallet-ledger.ts`**

Change the `.select(...)` call inside `creditShopEarnings` from:
```ts
.select('shop_id, order_number, items, payment_status')
```
to:
```ts
.select('shop_id, order_number, items, payment_status, is_preorder, status')
```

Add one new guard line immediately after the existing `if (order.payment_status !== 'paid') return` line:
```ts
if (order.is_preorder && order.status !== 'delivered') return
```

The rest of the function (computing `amount` via `computeOrderEarnings`, the `wallet_transactions` insert, the `23505` idempotency swallow) is unchanged.

- [ ] **Step 3: Add a delivery trigger in `updateOrderStatus`, in `lib/actions/products.ts`**

Find the existing block:
```ts
if ((status === 'cancelled' || status === 'refunded') && order?.shop_id && order?.payment_status === 'paid') {
  await reverseShopEarnings(orderId)
}
```

Add a parallel block immediately after it:
```ts
if (status === 'delivered' && order?.shop_id) {
  await creditShopEarnings(orderId)
}
```

`creditShopEarnings` is already imported at the top of this file (it's imported alongside `reverseShopEarnings` on line 8, per the existing `import { creditShopEarnings, reverseShopEarnings } from '@/lib/wallet-ledger'`) — no new import needed.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Run a real production build**

Run: `npm run build`
Expected: succeeds. `lib/actions/products.ts` is a `'use server'` file — confirm `updateOrderStatus` remains an `async function` export (it is; this change adds no new export, only modifies an existing function's body).

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all passing, no regressions — `lib/wallet-earnings.test.ts` (the pure `computeOrderEarnings` function, unchanged by this task) should still pass unmodified, confirming the earnings computation itself wasn't touched, only when it's allowed to fire.

- [ ] **Step 7: Trace through the four scenarios by hand and record the result in your task report**

This task has no automated test for `creditShopEarnings` (it touches the database via the admin client, and this codebase has no existing Supabase-mocking test pattern to extend — see this plan's Global Constraints). Instead, trace each scenario against the actual modified code and confirm the outcome in writing:

1. **Non-preorder shop order, payment confirmed via Paystack.** `creditShopEarnings` is called from `app/api/payment/verify/route.ts` right after `payment_status` is set to `'paid'`. At that point `order.is_preorder` is `false`, so the new guard (`if (order.is_preorder && ...)`) is false overall regardless of `status` — falls through, credits exactly as before this task.
2. **Pre-order shop order, payment confirmed via Paystack.** Same call site, same timing. `order.is_preorder` is `true`, `order.status` is `'paid'` (not yet `'delivered'`) — the guard returns early, no credit. Confirm no `wallet_transactions` row exists yet by checking a real test order's transaction history if a shop with a pre-order product exists in the dev database, or reason through the code path if not.
3. **That same pre-order order, later marked `'delivered'` by an admin.** `updateOrderStatus(orderId, 'delivered')` now calls `creditShopEarnings(orderId)`. Re-fetching the order inside `creditShopEarnings`, `payment_status` is still `'paid'`, `is_preorder` is `true`, `status` is now `'delivered'` — the guard passes, the function proceeds to compute and insert the credit. This is the first and only credit for this order.
4. **A non-preorder shop order, already credited at payment, later marked `'delivered'`.** `updateOrderStatus` calls `creditShopEarnings(orderId)` again (the new call site doesn't distinguish preorder from non-preorder). Inside the function, `is_preorder` is `false`, so the guard doesn't block it — it proceeds to attempt the same insert a second time. The existing `unique (order_id, type)` constraint on `wallet_transactions` rejects this as a duplicate (Postgres error code `23505`), which the existing `if (error && error.code !== '23505') throw` line already catches and silently swallows. No double credit, no error surfaced to the admin.

- [ ] **Step 8: Manual verification (requires a real pre-order shop order — set one up if the dev database has none)**

With `npm run dev`, using the diagnostic access already established for this project (`.env.local` has live Supabase credentials): create or find a shop with a pre-order product curated (Task 4 must be merged first for this to be possible through the UI), place a paid order for it, and confirm via a direct read of `wallet_transactions` that no credit row exists yet. Then, as an admin, mark that order `delivered` via `/admin/orders/[id]`, and confirm a credit row now exists with the correct amount, and that the shop's `/seller/wallet` balance reflects it.

- [ ] **Step 9: Commit**

```bash
git add lib/wallet-ledger.ts lib/actions/products.ts
git commit -m "feat: defer shop earnings for pre-order orders until admin marks them delivered"
```
