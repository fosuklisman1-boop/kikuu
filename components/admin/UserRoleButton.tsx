'use client'

import { useState } from 'react'
import { setUserRole } from '@/lib/actions/users'
import { ShieldCheck, User } from 'lucide-react'

interface Props {
  userId: string
  currentRole: 'admin' | 'customer'
}

export default function UserRoleButton({ userId, currentRole }: Props) {
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState(currentRole)

  async function toggle() {
    const next = role === 'admin' ? 'customer' : 'admin'
    setLoading(true)
    const result = await setUserRole(userId, next)
    setLoading(false)
    if (!result.error) setRole(next)
  }

  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
        role === 'admin'
          ? 'bg-purple-100 text-purple-700 border-purple-200'
          : 'bg-gray-100 text-gray-600 border-gray-200'
      }`}>
        {role === 'admin' ? <ShieldCheck size={12} /> : <User size={12} />}
        {role === 'admin' ? 'Admin' : 'Customer'}
      </span>
      <button
        onClick={toggle}
        disabled={loading}
        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
          role === 'admin'
            ? 'border-red-200 text-red-600 hover:bg-red-50'
            : 'border-purple-200 text-purple-600 hover:bg-purple-50'
        }`}
      >
        {loading ? '...' : role === 'admin' ? 'Remove Admin' : 'Make Admin'}
      </button>
    </div>
  )
}
