import TrackOrderForm from '@/components/store/TrackOrderForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Track Your Order' }

export default function TrackPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-xl font-extrabold text-gray-900 mb-1">Track your order</h1>
      <p className="text-sm text-gray-400 mb-5">
        Enter your order number and the phone number you ordered with to see where your order is.
      </p>
      <TrackOrderForm />
    </div>
  )
}
