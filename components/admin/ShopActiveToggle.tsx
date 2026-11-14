'use client'

import { useTransition } from 'react'
import { toggleShopActive } from '@/lib/actions/shops-admin'

export default function ShopActiveToggle({ shopId, active }: { shopId: string; active: boolean }) {
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      await toggleShopActive(shopId, !active)
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
        active ? 'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-700' : 'bg-red-50 text-red-700 hover:bg-emerald-50 hover:text-emerald-700'
      }`}
    >
      {active ? 'Active' : 'Suspended'}
    </button>
  )
}
