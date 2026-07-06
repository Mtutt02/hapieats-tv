'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import ReportButton from '@/components/video/ReportButton'
import type { Comment } from '@/types'

interface CommentsSectionProps {
  videoId: string
  initialComments: Comment[]
  currentUserId: string | null
}

export default function CommentsSection({
  videoId,
  initialComments,
  currentUserId,
}: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const handlePost = async () => {
    if (!body.trim() || posting) return
    setPosting(true)
    setError(null)

    try {
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      })

      if (res.status === 401) {
        window.location.href = `/login?redirect=/watch/${videoId}`
        return
      }

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to post comment')
        return
      }

      const data = await res.json()
      setComments((prev) => [...prev, data.comment as Comment])
      setBody('')

      // Scroll to the new comment
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPosting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    // Optimistically remove
    setComments((prev) => prev.filter((c) => c.id !== commentId))

    try {
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId }),
      })

      if (!res.ok) {
        // Restore the deleted comment by re-fetching
        const restored = await fetch(`/api/videos/${videoId}/comments`)
        if (restored.ok) {
          const data = await restored.json()
          setComments(data.comments ?? [])
        }
      }
    } catch {
      // Best-effort: don't restore since we can't confirm state
    }
  }

  const getInitial = (comment: Comment): string => {
    return (
      comment.author?.display_name?.charAt(0) ??
      comment.author?.username?.charAt(0) ??
      '?'
    ).toUpperCase()
  }

  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold mb-4">
        {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
      </h2>

      {/* Comment input */}
      {currentUserId ? (
        <div className="flex flex-col gap-2 mb-6">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            maxLength={2000}
            rows={3}
            disabled={posting}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{body.length}/2000</span>
            <Button
              onClick={handlePost}
              disabled={posting || body.trim().length === 0}
              size="sm"
            >
              {posting ? 'Posting…' : 'Post'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mb-6 text-sm text-muted-foreground">
          <Link
            href={`/login?redirect=/watch/${videoId}`}
            className="underline text-foreground hover:text-primary"
          >
            Sign in
          </Link>{' '}
          to leave a comment.
        </p>
      )}

      {/* Comment list */}
      <div className="space-y-5">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <Avatar className="h-8 w-8 shrink-0 mt-0.5">
              <AvatarImage src={comment.author?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs bg-primary text-white">
                {getInitial(comment)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-semibold leading-none">
                  {comment.author?.display_name ?? comment.author?.username ?? 'Unknown'}
                </span>
                {comment.author?.username && (
                  <span className="text-xs text-muted-foreground">
                    @{comment.author.username}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap break-words">{comment.body}</p>
            </div>
            <div className="shrink-0 flex items-center gap-2 mt-0.5">
              {currentUserId && currentUserId !== comment.author_id && (
                <ReportButton
                  targetId={comment.id}
                  type="comment"
                  userId={currentUserId}
                  compact
                />
              )}
              {currentUserId === comment.author_id && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  aria-label="Delete comment"
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div ref={bottomRef} />
    </section>
  )
}
