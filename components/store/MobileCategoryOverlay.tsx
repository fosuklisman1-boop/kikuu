'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category } from '@/lib/supabase/types'

interface MobileCategoryOverlayProps {
  open: boolean
  categories: Category[]
  onClose: () => void
}

export default function MobileCategoryOverlay({ open, categories, onClose }: MobileCategoryOverlayProps) {
  const parents = categories.filter((c) => c.parent_id === null)
  const childrenMap = categories.reduce<Record<string, Category[]>>((acc, c) => {
    if (c.parent_id) {
      acc[c.parent_id] = [...(acc[c.parent_id] ?? []), c]
    }
    return acc
  }, {})

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed inset-0 z-50 bg-white overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-[#ede8df] px-4 py-4 flex items-center justify-between">
            <h2 className="font-extrabold text-[#0a0a0a] text-lg">Categories</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#f5f2ed] text-[#6b6360] hover:bg-[#ede8df] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Category list */}
          <div className="px-4 py-6 space-y-8">
            {parents.length === 0 ? (
              <Link
                href="/products"
                onClick={onClose}
                className="text-sm text-[#b45309] font-semibold"
              >
                Browse all products →
              </Link>
            ) : (
              parents.map((parent) => {
                const children = childrenMap[parent.id] ?? []
                return (
                  <div key={parent.id}>
                    <Link
                      href={`/products?category=${parent.slug}`}
                      onClick={onClose}
                      className="block text-sm font-bold text-[#b45309] mb-3 hover:text-[#92400e]"
                    >
                      {parent.name}
                    </Link>
                    <div className="grid grid-cols-2 gap-2">
                      {children.map((child) => (
                        <Link
                          key={child.id}
                          href={`/products?category=${child.slug}`}
                          onClick={onClose}
                          className="text-sm text-[#6b6360] py-2 px-3 rounded-lg bg-[#f5f2ed] hover:bg-[#fdf6ec] hover:text-[#b45309] transition-colors"
                        >
                          {child.name}
                        </Link>
                      ))}
                      <Link
                        href={`/products?category=${parent.slug}`}
                        onClick={onClose}
                        className="text-xs font-semibold text-[#b45309] py-2 px-3 rounded-lg border border-[#b45309]/20 hover:bg-[#fdf6ec] transition-colors"
                      >
                        See all →
                      </Link>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
