'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reportId: string
  targetType: string
  targetId: string
  status: string
}

export default function AdminReportActions({ reportId, targetType, targetId, status }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const action = async (reportAction: string) => {
    setLoading(true)
    await fetch('/api/admin/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, action: reportAction, targetType, targetId }),
    })
    setLoading(false)
    router.refresh()
  }

  if (status !== 'pending' && status !== 'reviewed') {
    return <span className="text-xs text-muted-foreground italic">Resolved</span>
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => action('action')}
        disabled={loading}
        className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
      >
        Action Taken
      </button>
      <button
        onClick={() => action('dismiss')}
        disabled={loading}
        className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
      >
        Dismiss
      </button>
    </div>
  )
}
