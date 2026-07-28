'use client'

import { useState } from 'react'
import { Flag, Video, Users, CheckCircle2, XCircle, EyeOff, Eye, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, MessageSquare, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Report {
  id: string
  reason: string
  detail: string | null
  status: string
  created_at: string
  reporter: { id: string; username: string; display_name: string | null } | null
  video: {
    id: string
    title: string
    visibility: string
    is_flagged: boolean
    mux_playback_id: string | null
    channel: { name: string; slug: string } | null
  } | null
}

interface Stats {
  pending: number
  actionedToday: number
  flaggedVideos: number
  suspended: number
}

interface Comment {
  id: string
  body: string
  created_at: string
  author: { id: string; username: string; display_name: string | null } | null
  video: { id: string; title: string } | null
}

interface Props {
  reports: Report[]
  comments: Comment[]
  stats: Stats
  moderatorRole: string
}

type ReportAction = 'dismiss' | 'review' | 'action'
type VideoAction = 'flag' | 'unflag' | 'hide' | 'unhide'

type ModeTab = 'reports' | 'comments'

export default function ModerationClient({ reports: initial, comments: initialComments, stats, moderatorRole }: Props) {
  const [reports, setReports] = useState(initial)
  const [comments, setComments] = useState(initialComments)
  const [modeTab, setModeTab] = useState<ModeTab>('reports')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null)
  const isAdmin = ['admin', 'superadmin'].includes(moderatorRole)

  const deleteComment = async (commentId: string) => {
    setLoading(commentId)
    const res = await fetch('/api/admin/comments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId }),
    })
    if (res.ok) {
      setComments(c => c.filter(cm => cm.id !== commentId))
    }
    setLoading(null)
  }

  const flash = (id: string, msg: string, ok: boolean) => {
    setFeedback({ id, msg, ok })
    setTimeout(() => setFeedback(null), 3000)
  }

  const handleReport = async (reportId: string, action: ReportAction) => {
    setLoading(reportId + action)
    const res = await fetch('/api/admin/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, action }),
    })
    const json = await res.json()
    if (res.ok) {
      const newStatus = action === 'action' ? 'actioned' : action === 'dismiss' ? 'dismissed' : 'reviewed'
      setReports(r => r.map(rep => rep.id === reportId ? { ...rep, status: newStatus } : rep))
      flash(reportId, action === 'action' ? 'Actioned ✓' : action === 'dismiss' ? 'Dismissed ✓' : 'Marked reviewed ✓', true)
    } else {
      flash(reportId, json.error ?? 'Failed', false)
    }
    setLoading(null)
  }

  const handleVideo = async (reportId: string, videoId: string, action: VideoAction) => {
    setLoading(reportId + action)
    const res = await fetch('/api/admin/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, action, reason: 'Moderation action' }),
    })
    const json = await res.json()
    if (res.ok) {
      setReports(r => r.map(rep => {
        if (rep.id !== reportId || !rep.video) return rep
        return {
          ...rep,
          video: {
            ...rep.video,
            is_flagged: action === 'flag' ? true : action === 'unflag' ? false : rep.video.is_flagged,
            visibility: action === 'hide' ? 'private' : action === 'unhide' ? 'public' : rep.video.visibility,
          }
        }
      }))
      flash(reportId, `Video ${action === 'hide' ? 'hidden' : action === 'unhide' ? 'unhidden' : action === 'flag' ? 'flagged' : 'unflagged'} ✓`, true)
    } else {
      flash(reportId, json.error ?? 'Failed', false)
    }
    setLoading(null)
  }

  const pending = reports.filter(r => r.status === 'pending')
  const reviewed = reports.filter(r => r.status !== 'pending')

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Moderation</h1>
          <p className="text-muted-foreground mt-1">Review reported content and comments</p>
        </div>
        {/* Tab switcher */}
        <div className="flex rounded-xl border border-border overflow-hidden text-sm">
          <button
            onClick={() => setModeTab('reports')}
            className={`flex items-center gap-1.5 px-4 py-2 font-medium transition-colors ${modeTab === 'reports' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Flag className="h-3.5 w-3.5" /> Reports {stats.pending > 0 && <span className="ml-1 bg-orange-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">{stats.pending}</span>}
          </button>
          <button
            onClick={() => setModeTab('comments')}
            className={`flex items-center gap-1.5 px-4 py-2 font-medium transition-colors ${modeTab === 'comments' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Comments <span className="ml-1 text-xs text-muted-foreground">({comments.length})</span>
          </button>
        </div>
      </div>

      {/* Stats — always visible */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Pending Reports', value: stats.pending, icon: Flag, color: 'text-orange-400', urgent: stats.pending > 0 },
          { label: 'Actioned Today', value: stats.actionedToday, icon: CheckCircle2, color: 'text-green-400', urgent: false },
          { label: 'Flagged Videos', value: stats.flaggedVideos, icon: Video, color: 'text-red-400', urgent: false },
          { label: 'Suspended Users', value: stats.suspended, icon: Users, color: 'text-yellow-400', urgent: false },
        ].map(({ label, value, icon: Icon, color, urgent }) => (
          <div key={label} className={`bg-card border rounded-xl p-5 ${urgent ? 'border-orange-500/40' : 'border-border'}`}>
            <div className={`${color} mb-2`}><Icon className="h-5 w-5" /></div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Reports tab ─────────────────────────────────────────────── */}
      {modeTab === 'reports' && <>

      {/* Pending reports */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-400" />
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-400" />
            No pending reports — queue is clear!
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(report => (
              <ReportCard
                key={report.id}
                report={report}
                expanded={expanded === report.id}
                onToggle={() => setExpanded(e => e === report.id ? null : report.id)}
                onReport={handleReport}
                onVideo={handleVideo}
                loading={loading}
                feedback={feedback?.id === report.id ? feedback : null}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recently reviewed */}
      {reviewed.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Recently Reviewed ({reviewed.length})
          </h2>
          <div className="space-y-2">
            {reviewed.map(report => (
              <div key={report.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-sm font-medium truncate block">{report.video?.title ?? 'Unknown video'}</span>
                  <span className="text-xs text-muted-foreground">{report.reason} · {new Date(report.created_at).toLocaleDateString()}</span>
                </div>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                  report.status === 'actioned' ? 'bg-red-500/10 text-red-400' :
                  report.status === 'dismissed' ? 'bg-muted text-muted-foreground' :
                  'bg-yellow-500/10 text-yellow-400'
                }`}>
                  {report.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      </>}

      {/* ── Comments tab ─────────────────────────────────────────────── */}
      {modeTab === 'comments' && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            All Comments ({comments.length})
          </h2>
          {comments.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
              No comments yet.
            </div>
          ) : (
            <div className="space-y-2">
              {comments.map(comment => (
                <div key={comment.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold text-primary">
                        @{comment.author?.username ?? 'unknown'}
                      </span>
                      {comment.video && (
                        <a
                          href={`/watch/${comment.video.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary truncate max-w-[200px] inline-flex items-center gap-0.5"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          {comment.video.title}
                        </a>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 line-clamp-3">{comment.body}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8 p-0"
                    disabled={loading === comment.id}
                    onClick={() => deleteComment(comment.id)}
                    title="Delete comment"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReportCard({
  report, expanded, onToggle, onReport, onVideo, loading, feedback, isAdmin
}: {
  report: Report
  expanded: boolean
  onToggle: () => void
  onReport: (id: string, action: ReportAction) => void
  onVideo: (reportId: string, videoId: string, action: VideoAction) => void
  loading: string | null
  feedback: { msg: string; ok: boolean } | null
  isAdmin: boolean
}) {
  const video = report.video
  const isHidden = video?.visibility === 'private'
  const isFlagged = video?.is_flagged

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-orange-400 shrink-0">{report.reason}</span>
            {isFlagged && <span className="text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full">flagged</span>}
            {isHidden && <span className="text-xs bg-zinc-500/10 text-zinc-400 px-1.5 py-0.5 rounded-full">hidden</span>}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            Video: <span className="text-foreground">{video?.title ?? 'Unknown'}</span>
            {video?.channel && ` · ${video.channel.name}`}
            {' · '}Reported by @{report.reporter?.username ?? 'unknown'}
            {' · '}{new Date(report.created_at).toLocaleDateString()}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {/* Report detail */}
          {report.detail && (
            <div className="text-sm bg-muted/40 rounded-lg px-3 py-2 text-muted-foreground">
              "{report.detail}"
            </div>
          )}

          {/* Video link */}
          {video && (
            <div className="flex items-center gap-2">
              <a
                href={`/watch/${video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View video
              </a>
              {video.channel && (
                <a
                  href={`/channel/${video.channel.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  · {video.channel.name}
                </a>
              )}
            </div>
          )}

          {/* Feedback message */}
          {feedback && (
            <div className={`text-sm px-3 py-2 rounded-lg ${feedback.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {feedback.msg}
            </div>
          )}

          {/* Video actions */}
          {video && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Video Actions</p>
              <div className="flex flex-wrap gap-2">
                {!isFlagged ? (
                  <Button
                    size="sm" variant="outline"
                    className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
                    onClick={() => onVideo(report.id, video.id, 'flag')}
                    disabled={!!loading}
                  >
                    <Flag className="h-3.5 w-3.5 mr-1.5" /> Flag Video
                  </Button>
                ) : (
                  <Button
                    size="sm" variant="outline"
                    onClick={() => onVideo(report.id, video.id, 'unflag')}
                    disabled={!!loading}
                  >
                    <Flag className="h-3.5 w-3.5 mr-1.5" /> Unflag
                  </Button>
                )}
                {!isHidden ? (
                  <Button
                    size="sm" variant="outline"
                    className="border-red-500/40 text-red-400 hover:bg-red-500/10"
                    onClick={() => onVideo(report.id, video.id, 'hide')}
                    disabled={!!loading}
                  >
                    <EyeOff className="h-3.5 w-3.5 mr-1.5" /> Hide Video
                  </Button>
                ) : (
                  <Button
                    size="sm" variant="outline"
                    onClick={() => onVideo(report.id, video.id, 'unhide')}
                    disabled={!!loading}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1.5" /> Unhide
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Report resolution */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resolve Report</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-500 text-white"
                onClick={() => onReport(report.id, 'action')}
                disabled={!!loading}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Action Taken
              </Button>
              <Button
                size="sm" variant="outline"
                className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
                onClick={() => onReport(report.id, 'review')}
                disabled={!!loading}
              >
                Mark Reviewed
              </Button>
              <Button
                size="sm" variant="ghost"
                className="text-muted-foreground"
                onClick={() => onReport(report.id, 'dismiss')}
                disabled={!!loading}
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" /> Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
