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
