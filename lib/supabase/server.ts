import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { getCookieDomain } from '@/lib/cookie-domain'

export async function createClient() {
  const cookieStore = await cookies()
  const host = (await headers()).get('host') ?? ''
  const domain = getCookieDomain(host, process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? '')

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { domain },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — middleware handles session refresh
          }
        },
      },
    }
  )
}
