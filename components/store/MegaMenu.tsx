'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category } from '@/lib/supabase/types'
import { ArrowRight } from 'lucide-react'

interface MegaMenuProps {
  open: boolean
  categories: Category[]
  onClose: () => void
}

export default function MegaMenu({ open, categories, onClose }: MegaMenuProps) {
  // Group: parents (parent_id === null), children keyed by parent_id
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
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/20"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-full z-40 bg-white border-b border-[#ede8df] shadow-lg"
          >
            <div className="max-w-7xl mx-auto px-4 py-6">
              {parents.length === 0 ? (
                <Link
                  href="/products"
                  onClick={onClose}
                  className="text-sm text-[#b45309] font-semibold hover:text-[#92400e]"
                >
                  Browse all products →
                </Link>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  {parents.map((parent) => {
                    const children = childrenMap[parent.id] ?? []
                    return (
                      <div key={parent.id}>
                        <Link
                          href={`/products?category=${parent.slug}`}
                          onClick={onClose}
                          className="block text-sm font-bold text-[#b45309] mb-3 hover:text-[#92400e] transition-colors"
                        >
                          {parent.name}
                        </Link>
                        <ul className="space-y-1.5">
                          {children.map((child) => (
                            <li key={child.id}>
                              <Link
                                href={`/products?category=${child.slug}`}
                                onClick={onClose}
                                className="text-sm text-[#6b6360] hover:text-[#b45309] transition-colors"
                              >
                                {child.name}
                              </Link>
                            </li>
                          ))}
                          <li>
                            <Link
                              href={`/products?category=${parent.slug}`}
                              onClick={onClose}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#b45309] hover:text-[#92400e] mt-1 transition-colors"
                            >
                              See all <ArrowRight size={11} />
                            </Link>
                          </li>
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
