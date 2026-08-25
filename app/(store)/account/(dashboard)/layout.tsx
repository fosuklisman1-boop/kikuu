import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AccountSidebar from '@/components/store/AccountSidebar'
import { getMyShop } from '@/lib/actions/shops'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/account/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') redirect('/admin')

  const shop = await getMyShop()

  const meta = user.user_metadata as Record<string, string> | null
  const displayName = meta?.full_name || user.email?.split('@')[0] || 'My Account'
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <AccountSidebar
            displayName={displayName}
            email={user.email ?? ''}
            initials={initials}
            shopHref={shop ? '/seller/dashboard' : '/seller/onboarding'}
            shopLabel={shop ? 'My Shop' : 'Sell on Kikuu'}
          />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  )
}
