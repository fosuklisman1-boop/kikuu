'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Package, Clock } from 'lucide-react'

interface Props {
  activeTab: 'available' | 'preorder'
  availableCount: number
  preorderCount: number
}

export default function ProductTabs({ activeTab, availableCount, preorderCount }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function switchTab(tab: 'available' | 'preorder') {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'available') {
      params.delete('tab')
    } else {
      params.set('tab', 'preorder')
    }
    params.delete('page')
    router.push(`/products?${params.toString()}`)
  }

  return (
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => switchTab('available')}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
          activeTab === 'available'
            ? 'bg-green-600 text-white border-green-600 shadow-sm'
            : 'bg-white text-gray-600 border-[#e8e5e0] hover:border-gray-300 hover:text-gray-900'
        }`}
      >
        <Package size={14} />
        Available Now
        <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold ${
          activeTab === 'available'
            ? 'bg-white/20 text-white'
            : 'bg-gray-100 text-gray-500'
        }`}>
          {availableCount}
        </span>
      </button>

      <button
        onClick={() => switchTab('preorder')}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
          activeTab === 'preorder'
            ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
            : 'bg-white text-gray-600 border-[#e8e5e0] hover:border-gray-300 hover:text-gray-900'
        }`}
      >
        <Clock size={14} />
        Pre-order
        <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold ${
          activeTab === 'preorder'
            ? 'bg-white/20 text-white'
            : 'bg-gray-100 text-gray-500'
        }`}>
          {preorderCount}
        </span>
      </button>
    </div>
  )
}
