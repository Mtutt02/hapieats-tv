'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, MessageCircle, Send, X } from 'lucide-react'

interface CommentAuthor {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

interface Comment {
  id: string
  body: string
  created_at: string
  author: CommentAuthor | null
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w`
  return new Date(iso).toLocaleDateString()
}

function AuthorAvatar({ author }: { author: CommentAuthor | null }) {
  const name = author?.display_name || author?.username || '?'
  if (author?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={author.avatar_url}
        alt={name}
        className="h-8 w-8 rounded-full object-cover bg-zinc-800 shrink-0"
      />
    )
  }
  return (
    <div className="h-8 w-8 rounded-full bg-zinc-700 text-zinc-200 flex items-center justify-center text-xs font-bold shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function CommentsDrawer({
  clipId,
  onClose,
  onPosted,
}: {
  clipId: string
  onClose: () => void
  /** called with the new total-count delta (+1) after a successful post */
  onPosted?: (comment: Comment) => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/videos/${clipId}/comments`)
      if (!res.ok) throw new Error(`Failed to load comments (${res.status})`)
      const data = await res.json()
      setComments(Array.isArray(data.comments) ? data.comments : [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load comments')
    } finally {
      setLoading(false)
    }
  }, [clipId])

  useEffect(() => {
    load()
  }, [load])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    const body = draft.trim()
    if (!body || posting) return
    setPosting(true)
    setPostError(null)
    setNeedsAuth(false)
    try {
      const res = await fetch(`/api/videos/${clipId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (res.status === 401) {
        setNeedsAuth(true)
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Failed to post comment')
      }
      const data = await res.json()
      if (data.comment) {
        setComments(prev => [...prev, data.comment])
        onPosted?.(data.comment)
        setDraft('')
        // Scroll new comment into view
        requestAnimationFrame(() => {
          const el = listRef.current
          if (el) el.scrollTop = el.scrollHeight
        })
      }
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Comments">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div className="absolute bottom-0 inset-x-0 mx-auto w-full max-w-[560px] max-h-[70vh] bg-zinc-900 border border-zinc-800 rounded-t-2xl flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-100">
            Comments{comments.length > 0 ? ` (${comments.length})` : ''}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close comments"
            className="h-10 w-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Comment list */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 min-h-[160px]">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-zinc-500">
              <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading comments" />
            </div>
          ) : loadError ? (
            <div className="text-center py-10">
              <p className="text-sm text-zinc-400">{loadError}</p>
              <button
                onClick={load}
                className="mt-3 text-sm text-primary hover:underline min-h-[40px] px-4"
              >
                Try again
              </button>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-500 gap-2">
              <MessageCircle className="h-8 w-8" />
              <p className="text-sm">No comments yet — be the first!</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {comments.map(c => (
                <li key={c.id} className="flex gap-3">
                  <AuthorAvatar author={c.author} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-zinc-200 truncate">
                        {c.author?.display_name || c.author?.username || 'Anonymous'}
                      </span>
                      <span className="text-[11px] text-zinc-500 shrink-0">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-zinc-300 mt-0.5 break-words whitespace-pre-wrap">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Composer */}
        <div
          className="border-t border-zinc-800 px-4 py-3 shrink-0"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          {needsAuth ? (
            <p className="text-sm text-zinc-400 text-center py-1">
              <Link href="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>{' '}
              to join the conversation
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submit()
                  }
                }}
                maxLength={2000}
                placeholder="Add a comment…"
                aria-label="Add a comment"
                className="flex-1 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 text-sm rounded-full px-4 h-10 outline-none focus:ring-2 focus:ring-primary/60"
              />
              <button
                onClick={submit}
                disabled={posting || draft.trim().length === 0}
                aria-label="Post comment"
                className="h-10 w-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shrink-0"
              >
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          )}
          {postError && <p className="text-xs text-red-400 mt-2">{postError}</p>}
        </div>
      </div>
    </div>
  )
}
