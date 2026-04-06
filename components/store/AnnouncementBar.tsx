'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function AnnouncementBar() {
  const [visible, setVisible] = useState(true)
  const [messages, setMessages] = useState<string[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('announcements')
      .select('message')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data && data.length > 0) setMessages(data.map((r) => r.message))
      })
  }, [])

  if (!visible || messages.length === 0) return null

  const track = [...messages, ...messages]

  return (
    <div className="relative bg-[#0a0a0a] text-white overflow-hidden h-9 flex items-center border-b border-white/5">
      {/* Left fade */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10 pointer-events-none" />

      <div className="flex-1 overflow-hidden">
        <div className="marquee-track flex items-center gap-16 whitespace-nowrap">
          {track.map((msg, i) => (
            <span key={i} className="text-[11px] font-medium text-[#fdf6ec] shrink-0 tracking-wide flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-[#b45309] inline-block" />
              {msg}
            </span>
          ))}
        </div>
      </div>

      {/* Right fade */}
      <div className="absolute right-9 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10 pointer-events-none" />

      <button
        onClick={() => setVisible(false)}
        className="shrink-0 px-3 text-gray-600 hover:text-gray-300 transition-colors z-20"
        aria-label="Close announcement"
      >
        <X size={13} />
      </button>
    </div>
  )
}
