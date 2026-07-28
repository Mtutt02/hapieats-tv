'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Youtube, Link as LinkIcon, Plus, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function YouTubeUrlInput() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/videos/add-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl: url.trim(),
          title: title.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to add video')
        return
      }

      setSuccess(true)
      setUrl('')
      setTitle('')
      setTimeout(() => { setSuccess(false); setShowForm(false); router.refresh() }, 1500)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-zinc-700 hover:border-red-500/50 hover:bg-red-500/5 text-zinc-400 hover:text-red-400 transition-all text-sm font-medium"
      >
        <Plus className="h-4 w-4" />
        <Youtube className="h-4 w-4" />
        Add YouTube Video
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-800 p-4 space-y-3 bg-zinc-900/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-red-400">
          <Youtube className="h-4 w-4" />
          Add YouTube Video
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(false); setError(null); setSuccess(false) }}
          className="text-zinc-600 hover:text-zinc-400"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Input
        value={url}
        onChange={e => { setUrl(e.target.value); setError(null) }}
        placeholder="Paste YouTube URL here..."
        className="bg-zinc-800 border-zinc-700 text-sm"
      />

      <Input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Video title (optional)"
        className="bg-zinc-800 border-zinc-700 text-sm"
      />

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          YouTube video added!
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={!url.trim() || loading}
          size="sm"
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LinkIcon className="h-3.5 w-3.5" />
          )}
          {loading ? 'Adding...' : 'Add to page'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => { setShowForm(false); setError(null) }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
