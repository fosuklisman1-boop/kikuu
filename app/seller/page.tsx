import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getMyShop } from '@/lib/actions/shops'

export default async function SellerIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/account/login?redirect=/seller')

  const shop = await getMyShop()
  redirect(shop ? '/seller/dashboard' : '/seller/onboarding')
}
