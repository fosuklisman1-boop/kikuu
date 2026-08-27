'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { Store } from 'lucide-react'
import { addShopProducts } from '@/lib/actions/shop-products'
import MarkupForm from '@/components/seller/MarkupForm'

const POPOVER_WIDTH = 256 // w-64

export default function AddToShopButton({ productId, basePrice }: { productId: string; basePrice: number }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [markupType, setMarkupType] = useState<'flat' | 'percentage'>('flat')
  const [markupValue, setMarkupValue] = useState(0)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  function openPopover() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const left = Math.max(8, Math.min(rect.right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH - 8))
      setPosition({ top: rect.bottom + 8, left })
    }
    setOpen(true)
  }

  // Close on outside click — the popover is portaled to document.body, so it
  // is no longer a DOM descendant of the trigger for bubbling purposes.
  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMessage('')
    startTransition(async () => {
      const result = await addShopProducts({ productIds: [productId], markupType, markupValue })
      if (result.error) {
        setMessage(result.error)
      } else {
        setMessage('Added to your shop!')
        setTimeout(() => { setOpen(false); setMessage('') }, 1500)
      }
    })
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (open) {
            setOpen(false)
          } else {
            openPopover()
          }
        }}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow-sm text-[#6b6360] hover:text-[#b45309] transition-colors"
        aria-label="Add to my shop"
        title="Add to my shop"
      >
        <Store size={15} />
      </button>

      {open && position && createPortal(
        <div
          ref={popoverRef}
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          style={{ position: 'fixed', top: position.top, left: position.left, width: POPOVER_WIDTH }}
          className="bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-[100]"
        >
          <p className="text-xs font-semibold text-gray-700 mb-2">Add to my shop</p>
          <MarkupForm
            basePrice={basePrice}
            initialMarkupType={markupType}
            initialMarkupValue={markupValue}
            onChange={(type, value) => { setMarkupType(type); setMarkupValue(value) }}
          />
          <button
            onClick={handleAdd}
            disabled={pending}
            className="mt-2 w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
          >
            {pending ? 'Adding…' : 'Add'}
          </button>
          {message && <p className="mt-2 text-xs text-gray-600">{message}</p>}
        </div>,
        document.body
      )}
    </>
  )
}
