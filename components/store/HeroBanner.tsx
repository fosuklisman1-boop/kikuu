'use client'

import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, ShoppingBag, Truck, Shield, Star } from 'lucide-react'
import { useRef, useEffect, useState } from 'react'

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    const duration = 1500
    const steps = 60
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [inView, target])

  return <span ref={ref} className="tabular-nums">{count.toLocaleString()}{suffix}</span>
}

const STATS = [
  { label: 'Happy Customers', value: 12000, suffix: '+' },
  { label: 'Products', value: 5000, suffix: '+' },
  { label: 'Cities Covered', value: 16, suffix: '' },
  { label: 'Orders Delivered', value: 50000, suffix: '+' },
]

const TRUST_BADGES = [
  { icon: Truck, label: 'Free delivery over GHS 200' },
  { icon: Shield, label: 'Secure & encrypted payments' },
  { icon: ShoppingBag, label: '7-day easy returns' },
]

export default function HeroBanner() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#fdf3e3] via-[#faecd8] to-[#f5d5a0]">
      <div className="max-w-7xl mx-auto px-4 py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">

        {/* Left — text content */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 bg-white/60 text-[#b45309] text-xs font-bold px-4 py-2 rounded-full mb-6 border border-[#b45309]/20 shadow-sm tracking-wide uppercase">
              <span className="w-1.5 h-1.5 bg-[#b45309] rounded-full animate-pulse" />
              Ghana&apos;s #1 Online Store
              <span className="flex items-center gap-0.5 text-[#b45309]">
                <Star size={11} className="fill-[#b45309]" />
                <span>4.9</span>
              </span>
            </span>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-[#0a0a0a] leading-[1.03] mb-6 tracking-tight"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Shop
            <br />
            <span className="text-[#b45309] relative">
              Smarter
              <motion.span
                className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#b45309]/30 rounded-full"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.9 }}
              />
            </span>
            <br />
            in Ghana
          </motion.h1>

          <motion.p
            className="text-[#6b6360] text-lg mb-8 max-w-md leading-relaxed"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Fast delivery to Accra, Kumasi, Takoradi and all 16 regions.
            Pay with MTN MoMo, Vodafone Cash, or Card.
          </motion.p>

          <motion.div
            className="flex flex-wrap gap-3 mb-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Link href="/products">
              <motion.span
                className="inline-flex items-center gap-2 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white font-bold px-8 py-4 rounded-xl text-base transition-colors cursor-pointer shadow-lg"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
              >
                Shop Now
                <ArrowRight size={18} />
              </motion.span>
            </Link>
            <Link href="/products?sort=discount">
              <motion.span
                className="inline-flex items-center gap-2 border-2 border-[#b45309] text-[#b45309] hover:bg-[#b45309] hover:text-white font-semibold px-6 py-4 rounded-xl text-base transition-colors cursor-pointer"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
              >
                View Deals
              </motion.span>
            </Link>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            className="flex flex-wrap gap-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            {TRUST_BADGES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-[#6b6360] text-sm">
                <div className="w-7 h-7 rounded-lg bg-white/70 flex items-center justify-center shrink-0">
                  <Icon size={14} className="text-[#b45309]" />
                </div>
                <span>{label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right — floating product card */}
        <div className="hidden lg:flex items-center justify-center relative h-[380px]">
          {/* Main card */}
          <motion.div
            className="absolute bg-white rounded-3xl p-5 w-56 shadow-2xl border border-[#ede8df]"
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ top: '8%', left: '12%' }}
          >
            <div className="w-full h-28 bg-gradient-to-br from-[#fdf6ec] to-[#faecd8] rounded-2xl mb-3 flex items-center justify-center text-5xl">📱</div>
            <p className="text-[#0a0a0a] font-semibold text-sm">Samsung Galaxy</p>
            <div className="flex items-center gap-1 mt-0.5 mb-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={10} className="fill-[#b45309] text-[#b45309]" />
              ))}
              <span className="text-[#a89e96] text-xs ml-1">(128)</span>
            </div>
            <p className="text-[#b45309] font-extrabold text-lg">GHS 1,200</p>
          </motion.div>

          {/* Fashion card */}
          <motion.div
            className="absolute bg-white rounded-3xl p-5 w-48 shadow-2xl border border-[#ede8df]"
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            style={{ bottom: '2%', right: '8%' }}
          >
            <div className="w-full h-24 bg-gradient-to-br from-[#fdf6ec] to-[#faecd8] rounded-2xl mb-3 flex items-center justify-center text-4xl">👗</div>
            <p className="text-[#0a0a0a] font-semibold text-sm">Fashion</p>
            <p className="text-[#a89e96] text-xs line-through">GHS 120</p>
            <div className="flex items-center gap-2">
              <p className="text-[#b45309] font-extrabold">GHS 85</p>
              <span className="bg-[#b45309] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">-29%</span>
            </div>
          </motion.div>

          {/* Delivery notification */}
          <motion.div
            className="absolute bg-white rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3 border border-[#ede8df]"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            style={{ top: '4%', right: '2%' }}
          >
            <div className="w-8 h-8 bg-[#fdf6ec] rounded-xl flex items-center justify-center">
              <Truck size={16} className="text-[#b45309]" />
            </div>
            <div>
              <p className="text-[#0a0a0a] text-xs font-semibold">Order delivered!</p>
              <p className="text-[#a89e96] text-[10px]">Accra, East Legon</p>
            </div>
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-1" />
          </motion.div>

          {/* Stats pill */}
          <motion.div
            className="absolute bg-white rounded-2xl px-4 py-3 shadow-xl border border-[#ede8df]"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            style={{ bottom: '32%', left: '0%' }}
          >
            <p className="text-[#a89e96] text-[10px] uppercase tracking-wider">Happy Customers</p>
            <p className="text-[#0a0a0a] font-extrabold text-xl">12,000+</p>
          </motion.div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
        >
          {STATS.map(({ label, value, suffix }) => (
            <div key={label} className="bg-white/80 backdrop-blur-sm rounded-2xl px-5 py-4 border border-[#ede8df] text-center shadow-sm">
              <p className="text-2xl font-extrabold text-[#b45309]">
                <AnimatedCounter target={value} suffix={suffix} />
              </p>
              <p className="text-[#6b6360] text-xs mt-0.5 font-medium">{label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
