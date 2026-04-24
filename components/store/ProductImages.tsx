'use client'

import { useRef, useState } from 'react'

type MediaItem = { type: 'image' | 'video'; url: string }

export default function ProductImages({
  images,
  videos = [],
  name,
}: {
  images: string[]
  videos?: string[]
  name: string
}) {
  const media: MediaItem[] = [
    ...images.map((url) => ({ type: 'image' as const, url })),
    ...videos.map((url) => ({ type: 'video' as const, url })),
  ]

  const [active, setActive] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)

  if (!media.length) {
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
      {/* Main scroll strip */}
      <div
        ref={stripRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth rounded-xl aspect-square mb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {media.map((m, i) =>
          m.type === 'video' ? (
            <div key={i} className="w-full shrink-0 snap-center bg-black">
              <video
                src={m.url}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div key={i} className="w-full shrink-0 snap-center bg-gray-100">
              <img src={m.url} alt={i === 0 ? name : ''} className="w-full h-full object-cover" />
            </div>
          )
        )}
      </div>

      {/* Thumbnails */}
      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {media.map((m, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition ${
                i === active ? 'border-green-500' : 'border-transparent'
              }`}
            >
              {m.type === 'video' ? (
                <>
                  <video
                  src={m.url}
                  preload="metadata"
                  onLoadedMetadata={(e) => { (e.target as HTMLVideoElement).currentTime = 0.5 }}
                  className="w-full h-full object-cover"
                  muted
                />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <span className="text-white text-lg leading-none">▶</span>
                  </div>
                </>
              ) : (
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
