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
            <h3 className="text-3xl md:text-4xl font-extrabold text-[#0a0a0a] mb-4">
              Free Delivery in Accra
            </h3>
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
            <h3 className="text-2xl md:text-3xl font-extrabold mb-3">
              Get exclusive deals first! 🎉
            </h3>
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
