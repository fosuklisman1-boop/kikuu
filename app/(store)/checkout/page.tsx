import CheckoutForm from '@/components/store/CheckoutForm'
import { getShopContext } from '@/lib/shop-context'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Checkout' }

export default async function CheckoutPage() {
  const shopMode = !!(await getShopContext())
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Checkout</h1>
      <CheckoutForm shopMode={shopMode} />
    </div>
  )
}
