'use client'

import Link from 'next/link'
import type { Category } from '@/lib/supabase/types'
import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'

const CATEGORY_ICONS: Record<string, string> = {
  'electronics': '💻',
  'fashion': '👗',
  'home-living': '🏠',
  'health-beauty': '💄',
  'food-groceries': '🛒',
  'sports-outdoors': '⚽',
  'baby-kids': '🧸',
  'phones-tablets': '📱',
}

export default function CategoryGrid({ categories }: { categories: Category[] }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <div ref={ref} className="grid grid-cols-4 md:grid-cols-8 gap-3">
      {categories.map((cat, i) => (
        <motion.div
          key={cat.id}
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: i * 0.06, ease: [0.34, 1.56, 0.64, 1] }}
          whileHover={{ y: -4 }}
        >
          <Link
            href={`/products?category=${cat.slug}`}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white border border-[#ede8df] hover:border-[#b45309]/30 hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-all duration-300 group"
          >
            <motion.span
              className="text-2xl md:text-3xl"
              whileHover={{ scale: 1.2, rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.4 }}
            >
              {CATEGORY_ICONS[cat.slug] ?? '🏷️'}
            </motion.span>
            <span className="text-xs font-semibold text-[#6b6360] text-center group-hover:text-[#b45309] transition-colors leading-tight">
              {cat.name}
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  )
}
