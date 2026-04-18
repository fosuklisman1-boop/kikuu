'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import type { Banner } from '@/lib/supabase/types'

const FALLBACK: Banner = {
  id: 'fallback',
  title: 'Shop the Latest in Ghana',
  subtitle: 'Electronics, Fashion, Home & more. Fast delivery across all 16 regions.',
  image_url: '',
  cta_text: 'Shop Now',
  cta_link: '/products',
  sort_order: 0,
  active: true,
  created_at: '',
}

export default function HeroCarousel({ banners }: { banners: Banner[] }) {
  const slides = banners.length > 0 ? banners : [FALLBACK]
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const next = useCallback(() => setIndex((i) => (i + 1) % slides.length), [slides.length])
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length)

  useEffect(() => {
    if (paused || slides.length <= 1) return
    const id = setInterval(next, 5000)
    return () => clearInterval(id)
  }, [paused, next, slides.length])

  const slide = slides[index]

  return (
    <div
      className="relative w-full overflow-hidden bg-[#0a0a0a]"
      style={{ minHeight: '420px' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {slide.image_url ? (
            <img
              src={slide.image_url}
              alt={slide.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0a0a0a] via-[#1a1209] to-[#3d1f00]" />
          )}
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 flex flex-col justify-center h-full py-20 md:py-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={`content-${slide.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="max-w-xl"
          >
            <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-4">
              {slide.title}
            </h1>
            {slide.subtitle && (
              <p className="text-white/70 text-sm md:text-base mb-7 max-w-sm">
                {slide.subtitle}
              </p>
            )}
            {slide.cta_link && (
              <Link
                href={slide.cta_link}
                className="inline-flex items-center gap-2 bg-[#b45309] hover:bg-[#92400e] text-white font-bold px-6 py-3 rounded-xl transition-colors shadow-lg text-sm"
              >
                {slide.cta_text ?? 'Shop Now'} <ArrowRight size={16} />
              </Link>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Arrows — only if more than 1 slide */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`rounded-full transition-all ${
                i === index ? 'w-6 h-2 bg-[#b45309]' : 'w-2 h-2 bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
