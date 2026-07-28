'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, Trash2, ExternalLink, Search } from 'lucide-react'

interface Author {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

interface Video {
  id: string
  title: string
  is_flagged: boolean
  view_count: number | null
}

interface Comment {
  id: string
  body: string
  created_at: string
  updated_at: string | null
  author: Author | null
  video: Video | null
}

interface ReportEntry {
  id: string
  reason: string
  created_at: string
}

interface Props {
  comments: Comment[]
  totalCount: number
  reportMap: Record<string, ReportEntry>
  searchQuery: string
}

export default function CommentsClient({ comments, totalCount, reportMap, searchQuery }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState(searchQuery)

  const totalReported = Object.keys(reportMap).length

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment permanently? This cannot be undone.')) return

    setDeleting(prev => new Set(prev).add(commentId))

    try {
      const res = await fetch('/api/admin/comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId }),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(`Failed to delete: ${err.error ?? 'Unknown error'}`)
        return
      }

      router.refresh()
    } catch {
      alert('Network error — could not delete comment')
    } finally {
      setDeleting(prev => {
        const next = new Set(prev)
        next.delete(commentId)
        return next
      })
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    const qs = params.toString()
    router.push(qs ? `/admin/comments?${qs}` : '/admin/comments')
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Comment Moderation</h1>
            <p className="text-muted-foreground mt-1">
              {totalCount.toLocaleString()} total comments
              {totalReported > 0 && <span className="text-orange-400"> · {totalReported} reported</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-muted-foreground mb-1"><MessageSquare className="h-4 w-4" /></div>
          <div className="text-xl font-bold">{totalCount.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total Comments</div>
        </div>
        <div className={`bg-card border rounded-xl p-4 ${totalReported > 0 ? 'border-orange-500/40' : 'border-border'}`}>
          <div className={`mb-1 ${totalReported > 0 ? 'text-orange-400' : 'text-muted-foreground'}`}>
            <Trash2 className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold">{totalReported}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Pending Reports</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-blue-400 mb-1"><MessageSquare className="h-4 w-4" /></div>
          <div className="text-xl font-bold">
            {comments.filter(c => c.body && c.body.length > 100).length}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Long Comments</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-green-400 mb-1"><MessageSquare className="h-4 w-4" /></div>
          <div className="text-xl font-bold">{comments.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Loaded</div>
        </div>
      </div>

      {/* Reported comments alert */}
      {totalReported > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm flex items-center gap-3">
          <span>⚠ <strong>{totalReported} comment(s)</strong> have pending reports and need review</span>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search comment text..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
          />
        </div>
      </form>

      {/* Comments table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[35%]">Comment</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Author</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Video</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {comments.map(c => {
                const reported = reportMap[c.id]
                return (
                  <tr key={c.id} className={`hover:bg-muted/20 transition-colors ${reported ? 'bg-orange-500/5' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="text-sm leading-relaxed line-clamp-3 max-h-[60px] max-w-[400px] overflow-hidden break-words">
                        {c.body}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary flex-shrink-0">
                          {(c.author?.display_name ?? c.author?.username ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate max-w-[120px]">
                            {c.author?.display_name ?? c.author?.username ?? 'Deleted User'}
                          </div>
                          <div className="text-[10px] text-muted-foreground">@{c.author?.username ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.video ? (
                        <Link
                          href={`/watch/${c.video.id}`}
                          className="text-xs font-medium text-primary hover:underline truncate block max-w-[180px]"
                          target="_blank"
                        >
                          {c.video.title}
                          {c.video.is_flagged && <span className="text-red-400 ml-1">🚩</span>}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">[deleted]</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {reported ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 whitespace-nowrap">
                          Reported
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                          Clean
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      <div>{new Date(c.created_at).toLocaleDateString()}</div>
                      <div className="text-[10px]">
                        {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deleting.has(c.id)}
                          className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          {deleting.has(c.id) ? '...' : 'Delete'}
                        </button>
                        {c.video && (
                          <Link
                            href={`/watch/${c.video.id}`}
                            className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors inline-flex items-center gap-1"
                            target="_blank"
                          >
                            <ExternalLink className="h-3 w-3" /> View
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {comments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    {searchQuery ? 'No comments match your search' : 'No comments yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
