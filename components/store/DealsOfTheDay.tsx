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
