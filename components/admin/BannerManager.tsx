'use client'

import { useState } from 'react'
import { createAnnouncement, updateAnnouncement, deleteAnnouncement } from '@/lib/actions/announcements'
import { Plus, Trash2, Save } from 'lucide-react'

interface Message {
  id: string
  message: string
  active: boolean
  sort_order: number
}

export default function BannerManager({ initialMessages }: { initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages)
  const [newText, setNewText] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  async function handleAdd() {
    if (!newText.trim()) return
    setAdding(true)
    const result = await createAnnouncement(newText)
    setAdding(false)
    if (!result.error) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), message: newText.trim(), active: true, sort_order: prev.length }])
      setNewText('')
    }
  }

  async function handleSave(msg: Message) {
    setSaving(msg.id)
    await updateAnnouncement(msg.id, msg.message, msg.active)
    setSaving(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this message?')) return
    await deleteAnnouncement(id)
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  function update(id: string, patch: Partial<Message>) {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m))
  }

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="bg-gray-900 text-white rounded-xl overflow-hidden h-9 flex items-center px-4">
        <p className="text-xs text-gray-300 truncate">
          Preview: {messages.filter((m) => m.active).map((m) => m.message).join('  •  ') || 'No active messages'}
        </p>
      </div>

      {/* Messages list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {messages.length === 0 && (
          <p className="text-center py-8 text-sm text-gray-400">No messages yet. Add one below.</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="p-4 flex items-start gap-3">
            {/* Active toggle */}
            <button
              type="button"
              onClick={() => update(msg.id, { active: !msg.active })}
              className={`mt-0.5 w-9 h-5 rounded-full shrink-0 transition-colors relative ${msg.active ? 'bg-green-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${msg.active ? 'left-4' : 'left-0.5'}`} />
            </button>

            {/* Text input */}
            <input
              type="text"
              value={msg.message}
              onChange={(e) => update(msg.id, { message: e.target.value })}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-500"
            />

            {/* Save */}
            <button
              onClick={() => handleSave(msg)}
              disabled={saving === msg.id}
              className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
              title="Save"
            >
              <Save size={15} />
            </button>

            {/* Delete */}
            <button
              onClick={() => handleDelete(msg.id)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a new announcement message..."
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newText.trim()}
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 rounded-xl transition-colors disabled:opacity-50"
        >
          <Plus size={15} />
          Add
        </button>
      </div>
    </div>
  )
}
