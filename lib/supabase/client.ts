import { createBrowserClient } from '@supabase/ssr'
import { getCookieDomain } from '@/lib/cookie-domain'

export function createClient() {
  const domain = typeof window !== 'undefined'
    ? getCookieDomain(window.location.hostname, process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? '')
    : undefined

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { domain },
    }
  )
}
