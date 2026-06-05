import type { NextConfig } from "next";

// Content-Security-Policy. Allow-lists the third parties this app actually uses:
//   - Paystack inline checkout (js.paystack.co script + *.paystack.co/.com frames/api)
//   - Supabase (*.supabase.co for REST/storage/auth over https + realtime over wss)
// 'unsafe-inline' on script/style is the pragmatic choice without nonce wiring —
// Next.js hydration and Tailwind/framer-motion inject inline scripts/styles.
// NOTE: verify the live Paystack checkout still completes after enabling this; if
// payments break, the offending domain will show as a CSP violation in the console.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://*.paystack.co",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.paystack.co https://*.paystack.com",
  "frame-src 'self' https://*.paystack.co https://*.paystack.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const nextConfig: NextConfig = {
  transpilePackages: ['framer-motion'],
  turbopack: {
    resolveAlias: {
      'framer-motion': 'framer-motion/dist/cjs/index.js',
      'zustand': 'zustand/index.js',
      'zustand/middleware': 'zustand/middleware.js',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
