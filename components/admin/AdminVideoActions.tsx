'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  videoId: string
  isFlagged: boolean
  visibility: string
}

export default function AdminVideoActions({ videoId, isFlagged, visibility }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const action = async (type: string, extra?: Record<string, string>) => {
    setLoading(true)
    await fetch('/api/admin/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, action: type, ...extra }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {isFlagged ? (
        <button
          onClick={() => action('unflag')}
          disabled={loading}
          className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
        >
          Clear Flag
        </button>
      ) : (
        <button
          onClick={() => {
            const reason = prompt('Flag reason:')
            if (reason) action('flag', { reason })
          }}
          disabled={loading}
          className="text-xs px-2 py-1 rounded bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors"
        >
          Flag
        </button>
      )}
      {visibility !== 'private' && (
        <button
          onClick={() => action('hide')}
          disabled={loading}
          className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          Hide
        </button>
      )}
      {visibility === 'private' && (
        <button
          onClick={() => action('unhide')}
          disabled={loading}
          className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          Unhide
        </button>
      )}
      <button
        onClick={() => {
          if (confirm('Permanently delete this video? This cannot be undone.')) {
            action('delete')
          }
        }}
        disabled={loading}
        className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
      >
        Delete
      </button>
    </div>
  )
}
