'use client'

import { useState, useEffect, useTransition } from 'react'
import { slugify } from '@/lib/utils'
import { checkSlugAvailable, createShop } from '@/lib/actions/shops'

export default function ShopOnboardingForm() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!slugTouched) setSlug(slugify(name))
  }, [name, slugTouched])

  useEffect(() => {
    if (!slug || slug.length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailability('idle')
      return
    }
    setAvailability('checking')
    const timer = setTimeout(async () => {
      const available = await checkSlugAvailable(slug)
      setAvailability(available ? 'available' : 'taken')
    }, 400)
    return () => clearTimeout(timer)
  }, [slug])

  function handleSubmit(formData: FormData) {
    setError('')
    startTransition(async () => {
      const result = await createShop(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form action={handleSubmit} className="max-w-md space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Shop name</label>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm"
          placeholder="e.g. Ama's Fashion Store"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Shop URL</label>
        <div className="flex items-center border border-gray-300 rounded-xl px-4 py-2.5 text-sm gap-1">
          <span className="text-gray-400">/shop/</span>
          <input
            name="slug"
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true) }}
            required
            minLength={3}
            maxLength={40}
            className="flex-1 outline-none"
          />
        </div>
        {availability === 'checking' && <p className="text-xs text-gray-400 mt-1">Checking availability…</p>}
        {availability === 'available' && <p className="text-xs text-green-600 mt-1">Available</p>}
        {availability === 'taken' && <p className="text-xs text-red-600 mt-1">This URL is already taken</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || availability === 'taken' || availability === 'checking'}
        className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors"
      >
        {pending ? 'Creating your shop…' : 'Open my shop'}
      </button>
    </form>
  )
}
