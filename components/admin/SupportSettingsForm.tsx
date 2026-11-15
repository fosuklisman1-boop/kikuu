'use client'

import { useState, useTransition } from 'react'
import { updateSupportSettings } from '@/lib/actions/support'
import type { SupportSettings } from '@/lib/support'

const INPUT = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none'

export default function SupportSettingsForm({ initial }: { initial: SupportSettings }) {
  const [values, setValues] = useState(initial)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [pending, startTransition] = useTransition()

  function set<K extends keyof SupportSettings>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const result = await updateSupportSettings(values)
      if (result?.error) setMessage({ text: result.error, ok: false })
      else setMessage({ text: 'Saved. Storefronts now show these details.', ok: true })
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div>
        <label htmlFor="support-email" className="block text-xs font-medium text-slate-600 mb-1.5">Support email</label>
        <input id="support-email" type="email" value={values.email} onChange={(e) => set('email', e.target.value)}
          placeholder="support@telomall.com" className={INPUT} />
      </div>
      <div>
        <label htmlFor="support-phone" className="block text-xs font-medium text-slate-600 mb-1.5">Support phone</label>
        <input id="support-phone" type="tel" value={values.phone} onChange={(e) => set('phone', e.target.value)}
          placeholder="024 123 4567" className={INPUT} />
      </div>
      <div>
        <label htmlFor="support-whatsapp" className="block text-xs font-medium text-slate-600 mb-1.5">WhatsApp number</label>
        <input id="support-whatsapp" type="tel" value={values.whatsapp} onChange={(e) => set('whatsapp', e.target.value)}
          placeholder="024 123 4567" className={INPUT} />
        <p className="text-xs text-slate-400 mt-1">Customers tap this to open a WhatsApp chat with this number.</p>
      </div>

      {message && (
        <p className={`text-xs rounded-lg px-3 py-2 border ${message.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
          {message.text}
        </p>
      )}

      <button type="submit" disabled={pending}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
