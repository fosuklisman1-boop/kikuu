'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

// `url` may be path-relative (when no root domain is configured); prefix the
// current origin so the copied link works when pasted elsewhere.
export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const full = url.startsWith('/') ? `${window.location.origin}${url}` : url
    try {
      await navigator.clipboard.writeText(full)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Copy this link:', full)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 border border-gray-300 hover:border-green-600 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0"
    >
      {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
