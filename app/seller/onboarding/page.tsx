import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getMyShop } from '@/lib/actions/shops'
import ShopOnboardingForm from '@/components/seller/ShopOnboardingForm'

export default async function SellerOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/account/login?redirect=/seller/onboarding')

  const shop = await getMyShop()
  if (shop) redirect('/seller/dashboard')

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Open your shop</h1>
      <p className="text-gray-500 text-sm mb-8">
        Pick a name and URL for your shop. You can start adding products right after.
      </p>
      <ShopOnboardingForm />
    </div>
  )
}
