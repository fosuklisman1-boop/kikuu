'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { MapPin, Phone, Mail, ArrowUpRight } from 'lucide-react'

function FacebookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

const SOCIAL_LINKS = [
  { icon: FacebookIcon, label: 'Facebook', href: '#', color: 'hover:bg-blue-600 hover:border-blue-600' },
  { icon: InstagramIcon, label: 'Instagram', href: '#', color: 'hover:bg-pink-600 hover:border-pink-600' },
  { icon: XIcon, label: 'Twitter / X', href: '#', color: 'hover:bg-gray-700 hover:border-gray-600' },
  { icon: WhatsAppIcon, label: 'WhatsApp', href: '#', color: 'hover:bg-green-500 hover:border-green-500' },
]

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400">
      {/* Top gradient accent */}
      <div className="h-1 w-full bg-gradient-to-r from-[#b45309] via-[#d97706] to-[#b45309]" />

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 pt-16 pb-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
        {/* Brand — 2 cols */}
        <div className="lg:col-span-2">
          <motion.div
            className="flex items-center gap-2 mb-4"
            whileHover={{ scale: 1.02 }}
          >
            <div className="w-9 h-9 rounded-xl bg-[#b45309] flex items-center justify-center font-black text-white text-base">K</div>
            <span className="text-white font-extrabold text-2xl">
              kikuu
            </span>
          </motion.div>
          <p className="text-gray-500 text-sm leading-relaxed mb-5 max-w-xs">
            Ghana&apos;s trusted online marketplace. Shop thousands of products with fast delivery to your doorstep.
          </p>
          <div className="space-y-2.5 text-sm mb-6">
            <div className="flex items-center gap-2.5 text-gray-500">
              <MapPin size={14} className="text-[#b45309] shrink-0" />
              <span>Accra, Ghana</span>
            </div>
            <div className="flex items-center gap-2.5 text-gray-500">
              <Phone size={14} className="text-[#b45309] shrink-0" />
              <span>+233 XX XXX XXXX</span>
            </div>
            <div className="flex items-center gap-2.5 text-gray-500">
              <Mail size={14} className="text-[#b45309] shrink-0" />
              <span>hello@kikuu.com</span>
            </div>
          </div>
          {/* Social links */}
          <div className="flex items-center gap-2">
            {SOCIAL_LINKS.map(({ icon: Icon, label, href, color }) => (
              <Link
                key={label}
                href={href}
                title={label}
                className={`w-9 h-9 rounded-xl border border-gray-800 bg-gray-900 flex items-center justify-center text-gray-500 hover:text-white transition-all duration-200 ${color}`}
              >
                <Icon size={15} />
              </Link>
            ))}
          </div>
        </div>

        {/* Shop */}
        <div>
          <h4 className="text-white font-semibold text-sm mb-5 uppercase tracking-wider">Shop</h4>
          <ul className="space-y-3 text-sm">
            {[
              { label: 'All Products', href: '/products' },
              { label: 'Electronics', href: '/products?category=electronics' },
              { label: 'Fashion', href: '/products?category=fashion' },
              { label: 'Phones & Tablets', href: '/products?category=phones-tablets' },
              { label: 'Home & Living', href: '/products?category=home-living' },
              { label: 'Flash Deals', href: '/products?sort=discount' },
            ].map(({ label, href }) => (
              <li key={label}>
                <Link
                  href={href}
                  className="hover:text-[#f59e0b] hover:translate-x-1 transition-all duration-200 inline-flex items-center gap-1 group"
                >
                  {label}
                  <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Help */}
        <div>
          <h4 className="text-white font-semibold text-sm mb-5 uppercase tracking-wider">Help</h4>
          <ul className="space-y-3 text-sm">
            {[
              { label: 'Track Your Order', href: '/track' },
              { label: 'Contact Us', href: '/contact' },
              { label: 'Returns Policy', href: '/returns' },
              { label: 'FAQ', href: '/faq' },
              { label: 'Shipping Info', href: '/shipping' },
              { label: 'Seller Guide', href: '/sell' },
            ].map(({ label, href }) => (
              <li key={label}>
                <Link
                  href={href}
                  className="hover:text-[#f59e0b] hover:translate-x-1 transition-all duration-200 inline-flex items-center gap-1 group"
                >
                  {label}
                  <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Pay With + App */}
        <div>
          <h4 className="text-white font-semibold text-sm mb-5 uppercase tracking-wider">We Accept</h4>
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { label: 'MTN MoMo', color: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' },
              { label: 'Vodafone', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
              { label: 'AirtelTigo', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
              { label: 'Visa/MC', color: 'bg-gray-700/50 text-gray-300 border-gray-600/40' },
              { label: 'Bank', color: 'bg-[#b45309]/10 text-[#b45309] border-[#b45309]/20' },
            ].map(({ label, color }) => (
              <span key={label} className={`border ${color} text-[11px] font-semibold px-2.5 py-1 rounded-lg`}>
                {label}
              </span>
            ))}
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-2 uppercase tracking-wider">Powered by</p>
            <div className="flex items-center gap-2">
              <span className="bg-gray-800 border border-gray-700 text-gray-300 text-xs font-semibold px-3 py-1.5 rounded-lg">Paystack</span>
              <span className="bg-gray-800 border border-gray-700 text-gray-300 text-xs font-semibold px-3 py-1.5 rounded-lg">Supabase</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <p>
            &copy; {new Date().getFullYear()} Kikuu Technologies Ltd.{' '}
            <span className="text-gray-700">Made with love in Ghana 🇬🇭</span>
          </p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
            <Link href="/cookies" className="hover:text-gray-400 transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
