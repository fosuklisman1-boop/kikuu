'use client'

import { useState } from 'react'
import { banUser, unbanUser, deleteUser } from '@/lib/actions/users'
import { useRouter } from 'next/navigation'
import { ShieldOff, ShieldCheck, Trash2 } from 'lucide-react'

interface Props {
  userId: string
  isBanned: boolean
  userName: string
}

export default function UserBanButton({ userId, isBanned, userName }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  async function handleBanToggle() {
    if (!isBanned && !confirm(`Ban "${userName}"? They won't be able to sign in.`)) return
    setLoading('ban')
    if (isBanned) {
      await unbanUser(userId)
    } else {
      await banUser(userId)
    }
    setLoading(null)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete "${userName}"? This cannot be undone.`)) return
    setLoading('delete')
    await deleteUser(userId)
    router.push('/admin/users')
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={handleBanToggle}
        disabled={!!loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
          isBanned
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
        }`}
      >
        {isBanned ? <ShieldCheck size={15} /> : <ShieldOff size={15} />}
        {loading === 'ban' ? 'Working...' : isBanned ? 'Unban User' : 'Ban User'}
      </button>

      <button
        onClick={handleDelete}
        disabled={!!loading}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
      >
        <Trash2 size={15} />
        {loading === 'delete' ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  )
}
