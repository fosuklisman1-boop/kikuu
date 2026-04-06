import type { Metadata } from 'next'
import WishlistContent from '@/components/store/WishlistContent'

export const metadata: Metadata = { title: 'My Wishlist' }

export default function WishlistPage() {
  return <WishlistContent />
}
