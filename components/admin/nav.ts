import {
  LayoutDashboard, Package, ShoppingBag, Tag, Users, Truck, Megaphone, Ticket, Zap, Building2,
  TrendingUp, Palette, Store, Banknote, CreditCard,
} from 'lucide-react'

export const NAV_GROUPS = [
  {
    title: 'Sales',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
      { href: '/admin/users', label: 'Customers', icon: Users },
      { href: '/admin/shops', label: 'Shops', icon: Store },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { href: '/admin/products', label: 'Products', icon: Package },
      { href: '/admin/categories', label: 'Categories', icon: Tag },
      { href: '/admin/brands', label: 'Brands', icon: Building2 },
      { href: '/admin/product-options', label: 'Product Options', icon: Palette },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { href: '/admin/banner', label: 'Banner', icon: Megaphone },
      { href: '/admin/flash-sales', label: 'Flash Sales', icon: Zap },
      { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
      { href: '/admin/trending-searches', label: 'Trending Searches', icon: TrendingUp },
    ],
  },
  {
    title: 'Money & delivery',
    items: [
      { href: '/admin/withdrawals', label: 'Withdrawals', icon: Banknote },
      { href: '/admin/payments', label: 'Payment Gateways', icon: CreditCard },
      { href: '/admin/delivery', label: 'Delivery Fees', icon: Truck },
    ],
  },
]

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items)
