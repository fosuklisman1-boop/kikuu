'use client'

import { useCart, type CartItem } from '@/lib/cart'
import { formatGHS } from '@/lib/utils'
import { Minus, Plus, Trash2, Clock, RotateCcw } from 'lucide-react'

export default function CartItemRow({ item }: { item: CartItem }) {
  const { updateQty, removeItem } = useCart()
  const removed = item.quantity === 0

  if (removed) {
    return (
      <div className="bg-white rounded-2xl border border-[#ede9e4] p-4 flex items-center gap-4 opacity-60">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#f7f5f2] shrink-0 border border-[#f0ede8]">
          {item.image
            ? <img src={item.image} alt={item.name} className="w-full h-full object-cover grayscale" />
            : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 line-clamp-1">{item.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">Removed from cart</p>
        </div>
        <button
          onClick={() => updateQty(item.id, 1)}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#b45309] hover:text-[#92400e] bg-[#fdf6ec] hover:bg-[#faecd8] px-3 py-1.5 rounded-xl transition-colors shrink-0"
        >
          <RotateCcw size={12} /> Undo
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ede9e4] p-4 flex gap-4 hover:border-[#d4cfc8] transition-colors">
      {/* Image */}
      <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#f7f5f2] shrink-0 border border-[#f0ede8]">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <p className="font-medium text-gray-900 text-sm line-clamp-2 leading-snug flex-1">
            {item.name}
          </p>
          {item.is_preorder && (
            <span className="shrink-0 inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
              <Clock size={9} />
              Pre-order
            </span>
          )}
        </div>

        {(item.selected_color || item.selected_size) && (
          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
            {item.selected_color && (
              <>
                <span
                  className="w-3 h-3 rounded-full border border-gray-200 inline-block shrink-0"
                  style={{ background: item.selected_color.hex }}
                />
                <span>{item.selected_color.name}</span>
              </>
            )}
            {item.selected_color && item.selected_size && <span>·</span>}
            {item.selected_size && <span>{item.selected_size}</span>}
          </p>
        )}

        <p className="text-[#b45309] font-semibold text-sm mb-3">{formatGHS(item.price)}</p>

        <div className="flex items-center gap-2">
          {/* Qty controls */}
          <div className="flex items-center gap-0 border border-[#e8e5e0] rounded-xl overflow-hidden">
            <button
              onClick={() => updateQty(item.id, item.quantity - 1)}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <Minus size={12} />
            </button>
            <span className="w-9 text-center text-sm font-semibold text-gray-900 border-x border-[#e8e5e0]">
              {item.quantity}
            </span>
            <button
              onClick={() => updateQty(item.id, item.quantity + 1)}
              disabled={!item.is_preorder && item.quantity >= item.stock_qty}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus size={12} />
            </button>
          </div>

          <button
            onClick={() => removeItem(item.id)}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            aria-label="Remove item"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Line total */}
      <div className="shrink-0 text-right">
        <p className="font-bold text-gray-950 text-sm">{formatGHS(item.price * item.quantity)}</p>
        {item.quantity > 1 && (
          <p className="text-[11px] text-gray-400 mt-0.5">{item.quantity} × {formatGHS(item.price)}</p>
        )}
      </div>
    </div>
  )
}
