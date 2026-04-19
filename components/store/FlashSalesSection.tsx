'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { formatGHS } from '@/lib/utils'
import type { FlashSaleWithItems } from '@/lib/supabase/types'

function useCountdown(endsAt: string) {
  const getRemaining = () => Math.max(0, new Date(endsAt).getTime() - Date.now())
  const [ms, setMs] = useState(getRemaining)

  useEffect(() => {
    if (ms <= 0) return
    const id = setInterval(() => setMs(getRemaining()), 1000)
    return () => clearInterval(id)
  }, [endsAt])

  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0')
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')
  const s = (totalSeconds % 60).toString().padStart(2, '0')
  return { h, m, s, expired: ms <= 0 }
}

export default function FlashSalesSection({ sale }: { sale: FlashSaleWithItems }) {
  const { h, m, s, expired } = useCountdown(sale.ends_at)
  if (expired) return null

  return (
    <section className="bg-[#0a0a0a] py-10">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#b45309] text-white rounded-xl p-2">
              <Zap size={18} className="fill-white" />
            </div>
            <div>
              <p className="text-[#b45309] text-xs font-bold uppercase tracking-widest">Limited Time</p>
              <h2 className="text-xl font-extrabold text-white">{sale.title}</h2>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-white/10 rounded-xl px-4 py-2">
            {[h, m, s].map((unit, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-white font-extrabold text-lg tabular-nums">{unit}</span>
                {i < 2 && <span className="text-white/40 font-bold">:</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Product scroll */}
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {sale.items.map(({ product, sale_price }) => {
            const discount =
              product.compare_at_price && product.compare_at_price > sale_price
                ? Math.round((1 - sale_price / product.compare_at_price) * 100)
                : null

            return (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="shrink-0 w-44 bg-white rounded-2xl overflow-hidden hover:shadow-xl transition-shadow group"
              >
                <div className="relative">
                  {product.images?.[0] && (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  {discount !== null && (
                    <span className="absolute top-2 left-2 bg-[#b45309] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      -{discount}%
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs text-gray-700 font-medium line-clamp-2 mb-2 leading-snug">{product.name}</p>
                  <p className="text-[#b45309] font-extrabold text-sm">{formatGHS(sale_price)}</p>
                  {product.compare_at_price && (
                    <p className="text-gray-400 text-xs line-through">{formatGHS(product.compare_at_price)}</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
