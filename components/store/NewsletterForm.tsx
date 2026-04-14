'use client'

import { useState } from 'react'

export default function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <p className="text-white font-semibold text-sm bg-white/15 border border-white/25 rounded-xl px-6 py-3 inline-block">
        ✓ You&apos;re subscribed! Welcome to the TeloMall family 🎉
      </p>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email address"
        required
        className="flex-1 px-4 py-3 rounded-xl bg-white/15 border border-white/25 text-white placeholder:text-white/50 outline-none focus:border-white/60 focus:bg-white/20 transition-all text-sm backdrop-blur-sm"
      />
      <button
        type="submit"
        className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-6 py-3 rounded-xl transition-colors text-sm shrink-0 shadow-lg"
      >
        Subscribe
      </button>
    </form>
  )
}
