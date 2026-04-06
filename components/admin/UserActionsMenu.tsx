'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Eye, ShieldOff, ShieldCheck, Trash2 } from 'lucide-react'
import { banUser, unbanUser, deleteUser } from '@/lib/actions/users'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Props {
  userId: string
  isBanned: boolean
  userName: string
}

export default function UserActionsMenu({ userId, isBanned, userName }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleBanToggle() {
    setLoading('ban')
    if (isBanned) {
      await unbanUser(userId)
    } else {
      if (!confirm(`Ban "${userName}"? They will not be able to log in.`)) { setLoading(null); return }
      await banUser(userId)
    }
    setLoading(null)
    setOpen(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete "${userName}"? This cannot be undone.`)) return
    setLoading('delete')
    await deleteUser(userId)
    setLoading(null)
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20">
          <Link
            href={`/admin/users/${userId}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Eye size={14} className="text-gray-400" />
            View Profile
          </Link>

          <button
            onClick={handleBanToggle}
            disabled={loading === 'ban'}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors disabled:opacity-50 ${
              isBanned
                ? 'text-green-700 hover:bg-green-50'
                : 'text-yellow-700 hover:bg-yellow-50'
            }`}
          >
            {isBanned ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
            {loading === 'ban' ? 'Working...' : isBanned ? 'Unban User' : 'Ban User'}
          </button>

          <div className="border-t border-gray-50" />

          <button
            onClick={handleDelete}
            disabled={loading === 'delete'}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 size={14} />
            {loading === 'delete' ? 'Deleting...' : 'Delete User'}
          </button>
        </div>
      )}
    </div>
  )
}
