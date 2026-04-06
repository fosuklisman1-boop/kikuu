import Link from 'next/link'
import type { Category } from '@/lib/supabase/types'

const CATEGORY_ICONS: Record<string, string> = {
  'electronics':     '💻',
  'fashion':         '👗',
  'home-living':     '🏠',
  'health-beauty':   '✨',
  'food-groceries':  '🛒',
  'sports-outdoors': '⚽',
  'baby-kids':       '🧸',
  'phones-tablets':  '📱',
}

export default function CategoryFilter({
  categories,
  selected,
}: {
  categories: Category[]
  selected: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#ede9e4] overflow-hidden shadow-sm">
      <div className="px-4 py-3.5 border-b border-[#f0ede8]">
        <h3 className="font-semibold text-gray-900 text-sm tracking-wide">Categories</h3>
      </div>
      <ul className="p-2">
        <li>
          <Link
            href="/products"
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
              !selected
                ? 'bg-green-50 text-green-800 font-semibold'
                : 'text-gray-600 hover:bg-[#f7f5f2] hover:text-gray-900'
            }`}
          >
            <span className="text-base leading-none">🏷️</span>
            All Products
            {!selected && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500" />
            )}
          </Link>
        </li>
        {categories.map((cat) => {
          const active = selected === cat.slug
          return (
            <li key={cat.id}>
              <Link
                href={`/products?category=${cat.slug}`}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  active
                    ? 'bg-green-50 text-green-800 font-semibold'
                    : 'text-gray-600 hover:bg-[#f7f5f2] hover:text-gray-900'
                }`}
              >
                <span className="text-base leading-none">
                  {CATEGORY_ICONS[cat.slug] ?? '📦'}
                </span>
                {cat.name}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500" />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
