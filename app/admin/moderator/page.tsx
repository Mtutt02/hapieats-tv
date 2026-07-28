import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Flag, Video, Users, CheckCircle2, MessageSquare, AlertTriangle, ShieldCheck, ExternalLink, Clock, Bot } from 'lucide-react'
import Link from 'next/link'
import AIScanButton from '@/components/admin/AIScanButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Moderator Dashboard — HapiEats TV' }

export default async function ModeratorDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin/moderator')

  const { data: me } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  // Only moderators land here; admins/superadmins go to /admin
  if (!me || !['moderator'].includes(me.role ?? '')) {
    redirect('/admin')
  }

  const service = createServiceClient()

  const [
    { count: pendingReports },
    { count: actionedToday },
    { count: flaggedVideos },
    { count: suspendedUsers },
    { count: totalComments },
    { data: recentReports },
    { data: recentFlagged },
    { data: recentComments },
    { data: aiReports },
  ] = await Promise.all([
    service.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    service.from('content_reports').select('*', { count: 'exact', head: true })
      .eq('status', 'actioned')
      .gte('reviewed_at', new Date(Date.now() - 86400000).toISOString()),
    service.from('videos').select('*', { count: 'exact', head: true }).eq('is_flagged', true),
    service.from('profiles').select('*', { count: 'exact', head: true }).not('suspended_at', 'is', null),
    service.from('comments').select('*', { count: 'exact', head: true }),
    // Recent pending reports
    service.from('content_reports')
      .select(`
        id, reason, detail, status, created_at,
        reporter:profiles!content_reports_reporter_id_fkey(username, display_name),
        video:videos!content_reports_video_id_fkey(id, title, is_flagged)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
    // Flagged videos
    service.from('videos')
      .select('id, title, view_count, created_at, mux_playback_id, channel:channels(name)')
      .eq('is_flagged', true)
      .order('created_at', { ascending: false })
      .limit(5),
    // Recent comments
    service.from('comments')
      .select(`
        id, body, created_at,
        author:profiles!comments_author_id_fkey(username, display_name),
        video:videos!comments_video_id_fkey(id, title)
      `)
      .order('created_at', { ascending: false })
      .limit(8),
    // Recent AI-flagged reports
    service.from('content_reports')
      .select('id, reason, detail, status, created_at')
      .like('reason', 'ai:%')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedReports = (recentReports ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedFlagged = (recentFlagged ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedComments = (recentComments ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedAiReports = (aiReports ?? []) as any[]

  // Category → readable label
  const AI_CATEGORY_LABELS: Record<string, string> = {
    hate_speech: 'Hate Speech',
    harassment: 'Harassment',
    sexual: 'Sexual Content',
    spam: 'Spam',
    violence: 'Violence',
    doxxing: 'Doxxing',
    illegal: 'Illegal Activity',
  }

  const stats = [
    { label: 'Pending Reports', value: pendingReports ?? 0, icon: Flag, color: 'text-orange-400', bg: 'border-orange-500/30', href: '/admin/moderation', urgent: (pendingReports ?? 0) > 0 },
    { label: 'Actioned Today',  value: actionedToday ?? 0,  icon: CheckCircle2, color: 'text-green-400',  bg: 'border-border',            href: '/admin/moderation' },
    { label: 'Flagged Videos',  value: flaggedVideos ?? 0,  icon: Video,        color: 'text-red-400',    bg: 'border-border',            href: '/admin/videos'     },
    { label: 'Suspended Users', value: suspendedUsers ?? 0, icon: Users,        color: 'text-yellow-400', bg: 'border-border',            href: '/admin/moderation' },
    { label: 'Total Comments',  value: totalComments ?? 0,  icon: MessageSquare,color: 'text-blue-400',   bg: 'border-border',            href: '/admin/moderation' },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-5 w-5 text-blue-400" />
            <h1 className="text-2xl font-bold">Moderator Dashboard</h1>
          </div>
          <p className="text-muted-foreground">
            Welcome back, <span className="text-foreground font-medium">{me.display_name ?? 'Moderator'}</span>
          </p>
        </div>
        <Link
          href="/admin/moderation"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Flag className="h-4 w-4" />
          Open Moderation Queue
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {stats.map(({ label, value, icon: Icon, color, bg, href, urgent }) => (
          <Link
            key={label}
            href={href}
            className={`bg-card border ${urgent ? bg : 'border-border'} rounded-xl p-4 hover:border-primary/40 transition-colors`}
          >
            <div className={`${color} mb-2`}><Icon className="h-4 w-4" /></div>
            <div className="text-xl font-bold">{value.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </Link>
        ))}
      </div>

      {/* Urgent alert */}
      {(pendingReports ?? 0) > 0 && (
        <Link
          href="/admin/moderation"
          className="flex items-center gap-3 mb-6 px-4 py-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-sm text-orange-400 hover:bg-orange-500/15 transition-colors"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{pendingReports} pending report{(pendingReports ?? 0) !== 1 ? 's' : ''}</strong> awaiting review
          </span>
          <span className="ml-auto text-xs">Review now →</span>
        </Link>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Pending reports */}
        <div className="lg:col-span-2 space-y-6">

          {/* Pending reports */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold flex items-center gap-2">
                <Flag className="h-4 w-4 text-orange-400" />
                Pending Reports
                {(pendingReports ?? 0) > 0 && (
                  <span className="ml-1 bg-orange-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                    {pendingReports}
                  </span>
                )}
              </h2>
              <Link href="/admin/moderation" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            <div className="divide-y divide-border">
              {typedReports.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400 opacity-60" />
                  <p className="text-sm text-muted-foreground">Queue is clear!</p>
                </div>
              ) : typedReports.map((r) => (
                <div key={r.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-orange-400">{r.reason}</span>
                        {r.video?.is_flagged && (
                          <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full">flagged</span>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">{r.video?.title ?? 'Unknown video'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        by @{r.reporter?.username ?? 'unknown'}
                        {' · '}{new Date(r.created_at).toLocaleDateString()}
                      </p>
                      {r.detail && (
                        <p className="text-xs text-muted-foreground/70 mt-1 italic truncate">"{r.detail}"</p>
                      )}
                    </div>
                    {r.video?.id && (
                      <a
                        href={`/watch/${r.video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                        title="View video"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {typedReports.length > 0 && (
              <div className="px-5 py-3 border-t border-border bg-muted/20">
                <Link
                  href="/admin/moderation"
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Open full queue to take action →
                </Link>
              </div>
            )}
          </div>

          {/* AI Patrol */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-start justify-between px-5 py-4 border-b border-border gap-3 flex-wrap">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <Bot className="h-4 w-4 text-blue-400" />
                  AI Patrol
                  {typedAiReports.length > 0 && (
                    <span className="ml-1 bg-blue-500/15 text-blue-400 text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none border border-blue-500/20">
                      {typedAiReports.length}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Runs every 10 min — flags content automatically</p>
              </div>
              <AIScanButton />
            </div>
            <div className="divide-y divide-border">
              {typedAiReports.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Bot className="h-8 w-8 mx-auto mb-2 text-blue-400 opacity-40" />
                  <p className="text-sm text-muted-foreground">No AI flags yet — patrol runs every 10 min</p>
                </div>
              ) : typedAiReports.map((r) => {
                const rawCategory = (r.reason as string).replace('ai:', '')
                const categoryLabel = AI_CATEGORY_LABELS[rawCategory] ?? rawCategory
                return (
                  <div key={r.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className={`shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                        r.status === 'pending'
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                          : 'bg-green-500/10 text-green-400 border-green-500/20'
                      }`}>
                        {r.status}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-blue-400">{categoryLabel}</p>
                        {r.detail && (
                          <p className="text-xs text-foreground/80 mt-0.5 line-clamp-2">{r.detail}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(r.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-3 border-t border-border bg-muted/20">
              <Link href="/admin/moderation" className="text-xs text-primary hover:underline font-medium">
                Review all flagged content →
              </Link>
            </div>
          </div>

          {/* Recent comments */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-400" />
                Recent Comments
              </h2>
              <Link href="/admin/moderation" className="text-xs text-primary hover:underline">Manage →</Link>
            </div>
            <div className="divide-y divide-border">
              {typedComments.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">No comments yet</div>
              ) : typedComments.map((c) => (
                <div key={c.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-semibold text-primary">
                          @{c.author?.username ?? 'unknown'}
                        </span>
                        {c.video && (
                          <a
                            href={`/watch/${c.video.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary truncate max-w-[160px] inline-flex items-center gap-0.5"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            {c.video.title}
                          </a>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto shrink-0 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 line-clamp-2">{c.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-border bg-muted/20">
              <Link
                href="/admin/moderation"
                className="text-xs text-primary hover:underline font-medium"
              >
                View all comments & delete →
              </Link>
            </div>
          </div>

        </div>

        {/* Right: Flagged videos + quick actions */}
        <div className="space-y-6">

          {/* Flagged videos */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold flex items-center gap-2">
                <Video className="h-4 w-4 text-red-400" />
                Flagged Videos
                {(flaggedVideos ?? 0) > 0 && (
                  <span className="ml-1 text-xs bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                    {flaggedVideos}
                  </span>
                )}
              </h2>
              <Link href="/admin/videos" className="text-xs text-primary hover:underline">All videos →</Link>
            </div>
            <div className="divide-y divide-border">
              {typedFlagged.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                  No flagged videos
                </div>
              ) : typedFlagged.map((v) => (
                <div key={v.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.channel?.name ?? '—'}
                      {' · '}{(v.view_count ?? 0).toLocaleString()} views
                    </p>
                  </div>
                  <a
                    href={`/watch/${v.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-4 text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              Quick Actions
            </h2>
            <div className="space-y-2">
              {[
                { href: '/admin/moderation', label: '🛡️  Moderation Queue', desc: 'Review reported content' },
                { href: '/admin/reports',    label: '🚩  All Reports',       desc: 'Browse full report log' },
                { href: '/admin/videos',     label: '🎬  Videos',            desc: 'Flag, hide, or unflag' },
              ].map(({ href, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col px-3 py-2.5 rounded-xl text-sm hover:bg-muted transition-colors"
                >
                  <span className="font-medium text-foreground">{label}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{desc}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Mod guidelines reminder */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-400 mb-2">Moderation Guidelines</p>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li>✦ Review reports within <span className="text-foreground">24 hours</span></li>
              <li>✦ Flag videos that violate <Link href="/guidelines" className="text-blue-400 hover:underline">community guidelines</Link></li>
              <li>✦ Escalate serious violations to an <span className="text-foreground">admin</span></li>
              <li>✦ Do not dismiss without reviewing the content</li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  )
}
