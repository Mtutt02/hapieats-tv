'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  userId: string
  role: string
  suspended: boolean
  isCreator: boolean
  callerRole: string
}

export default function AdminUserActions({ userId, role, suspended, isCreator, callerRole }: Props) {
  const [loading, setLoading] = useState(false)
  const [creatorStatus, setCreatorStatus] = useState(isCreator)
  const router = useRouter()

  const action = async (type: string, extra?: Record<string, string>) => {
    setLoading(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: type, ...extra }),
    })
    if (type === 'toggle_creator' && res.ok) {
      const data = await res.json()
      setCreatorStatus(data.isCreator)
    }
    setLoading(false)
    if (type !== 'toggle_creator') router.refresh()
  }

  const isSuperAdmin = role === 'superadmin'
  const callerIsSuperAdmin = callerRole === 'superadmin'

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {!isSuperAdmin && (
        <>
          {suspended ? (
            <button
              onClick={() => action('unsuspend')}
              disabled={loading}
              className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
            >
              Unsuspend
            </button>
          ) : (
            <button
              onClick={() => {
                const reason = prompt('Suspension reason:')
                if (reason) action('suspend', { reason })
              }}
              disabled={loading}
              className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Suspend
            </button>
          )}
          {role !== 'admin' && (
            <button
              onClick={() => action('promote')}
              disabled={loading}
              className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              Make Admin
            </button>
          )}
          {role === 'admin' && (
            <button
              onClick={() => action('demote')}
              disabled={loading}
              className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              Remove Admin
            </button>
          )}
        </>
      )}

      {/* Creator toggle — superadmin only, works on all users including superadmin */}
      {callerIsSuperAdmin && (
        <button
          onClick={() => action('toggle_creator')}
          disabled={loading}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            creatorStatus
              ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
              : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
          }`}
        >
          {creatorStatus ? '★ Creator' : '☆ Grant Creator'}
        </button>
      )}

      {isSuperAdmin && !callerIsSuperAdmin && (
        <span className="text-xs text-muted-foreground italic">Protected</span>
      )}
    </div>
  )
}
