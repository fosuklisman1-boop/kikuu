'use client'

import { useRef, useState } from 'react'

export default function ProductImages({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)

  if (!images.length) {
    return (
      <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center text-6xl">
        📦
      </div>
    )
  }

  function scrollTo(index: number) {
    setActive(index)
    stripRef.current?.children[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const index = Math.round(el.scrollLeft / el.offsetWidth)
    if (index !== active) setActive(index)
  }

  return (
    <div>
      {/* Main horizontal scroll strip */}
      <div
        ref={stripRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth rounded-xl aspect-square gap-0 mb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((img, i) => (
          <div key={i} className="w-full shrink-0 snap-center bg-gray-100">
            <img src={img} alt={i === 0 ? name : ''} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>

      {/* Thumbnails (scrollable when many images) */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition ${
                i === active ? 'border-green-500' : 'border-transparent'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
