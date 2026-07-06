import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  ShieldCheck, Users, Flag, BadgeDollarSign, ClipboardList,
  TrendingDown, AlertCircle, UserX, Crown, Video, Settings,
  CheckCircle, XCircle, Clock, Activity, MessageSquare, Radio,
  UserPlus, ExternalLink,
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Superadmin — HapiEats TV' }

export default async function SuperadminDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin/superadmin')

  const service = createServiceClient()
  const { data: me } = await service.from('profiles').select('role, display_name').eq('id', user.id).single()

  if (!me || me.role !== 'superadmin') redirect('/admin')

  // ── Fetch all dashboard data in parallel ──────────────────────
  const [
    { count: pendingReports },
    { count: flaggedVideos },
    { count: suspendedUsers },
    { count: totalUsers },
    { count: liveStreams },
    { data: adminTeam },
    { data: recentReports },
    { data: outstandingLoans },
    creditStats,
    { data: recentComments },
    { data: recentChatMessages },
    { data: recentSignups },
  ] = await Promise.all([
    service.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    service.from('videos').select('*', { count: 'exact', head: true }).eq('is_flagged', true),
    service.from('profiles').select('*', { count: 'exact', head: true }).not('suspended_at', 'is', null),
    service.from('profiles').select('*', { count: 'exact', head: true }),
    service.from('live_streams').select('*', { count: 'exact', head: true }).eq('is_live', true),
    service.from('profiles')
      .select('id, username, display_name, role, created_at')
      .in('role', ['admin', 'moderator', 'superadmin'])
      .order('role')
      .limit(20),
    service.from('content_reports')
      .select(`id, reason, status, created_at, reporter:profiles!content_reports_reporter_id_fkey(username), video:videos!content_reports_video_id_fkey(id, title)`)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
    service.from('app_credits')
      .select(`loan_balance, loan_repaid, user:profiles!app_credits_user_id_fkey(username, display_name)`)
      .gt('loan_balance', 0)
      .order('loan_balance', { ascending: false })
      .limit(10),
    service.from('credit_requests').select('status').then(r => {
      const rows = r.data ?? []
      return {
        pending: rows.filter(x => x.status === 'pending').length,
        approved: rows.filter(x => x.status === 'approved').length,
        denied: rows.filter(x => x.status === 'denied').length,
      }
    }),
    // All recent video comments
    service.from('comments')
      .select(`id, body, created_at,
               author:profiles!comments_author_id_fkey(username, display_name),
               video:videos!comments_video_id_fkey(id, title)`)
      .order('created_at', { ascending: false })
      .limit(15),
    // Recent live chat messages
    service.from('live_chat_messages')
      .select(`id, message, type, created_at,
               sender:profiles!live_chat_messages_sender_id_fkey(username, display_name),
               stream:live_streams!live_chat_messages_stream_id_fkey(id, title)`)
      .eq('type', 'message')
      .order('created_at', { ascending: false })
      .limit(15),
    // Recent signups
    service.from('profiles')
      .select('id, username, display_name, role, avatar_url, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const totalLoanExposure = (outstandingLoans ?? []).reduce(
    (s, l: any) => s + parseFloat(l.loan_balance ?? '0'), 0
  )

  const ROLE_COLORS: Record<string, string> = {
    superadmin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    admin: 'bg-primary/10 text-primary border-primary/20',
    moderator: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Superadmin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Full platform control — moderation, loans, team, and settings</p>
        </div>
      </div>

      {/* ── Platform health stats ────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Users',      value: totalUsers ?? 0,      icon: Users,          color: 'text-blue-400',   href: '/admin/users' },
          { label: 'Pending Reports',  value: pendingReports ?? 0,  icon: Flag,           color: 'text-orange-400', href: '/admin/moderation', urgent: (pendingReports ?? 0) > 0 },
          { label: 'Flagged Videos',   value: flaggedVideos ?? 0,   icon: Video,          color: 'text-red-400',    href: '/admin/moderation', urgent: (flaggedVideos ?? 0) > 0 },
          { label: 'Suspended Users',  value: suspendedUsers ?? 0,  icon: UserX,          color: 'text-yellow-400', href: '/admin/users' },
          { label: 'Live Now',         value: liveStreams ?? 0,      icon: Activity,       color: 'text-pink-400',   href: '/' },
        ].map(({ label, value, icon: Icon, color, href, urgent }) => (
          <Link
            key={label}
            href={href}
            className={`bg-card border rounded-xl p-4 hover:border-primary/40 transition-colors ${urgent ? 'border-orange-500/40' : 'border-border'}`}
          >
            <Icon className={`h-4 w-4 mb-2 ${color}`} />
            <div className="text-xl font-bold">{value.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </Link>
        ))}
      </div>

      {/* ── Alerts ───────────────────────────────────────────── */}
      <div className="space-y-2">
        {(pendingReports ?? 0) > 0 && (
          <Link href="/admin/moderation" className="flex items-center gap-3 px-4 py-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-sm text-orange-400 hover:bg-orange-500/15 transition-colors">
            <Flag className="h-4 w-4 shrink-0" />
            <span><strong>{pendingReports} pending report{(pendingReports ?? 0) !== 1 ? 's' : ''}</strong> need moderation review</span>
            <span className="ml-auto text-xs">Review →</span>
          </Link>
        )}
        {(creditStats as any).pending > 0 && (
          <Link href="/admin/credits" className="flex items-center gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-yellow-400 hover:bg-yellow-500/15 transition-colors">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span><strong>{(creditStats as any).pending} credit request{(creditStats as any).pending !== 1 ? 's' : ''}</strong> waiting for approval</span>
            <span className="ml-auto text-xs">Review →</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Moderation queue preview */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-orange-400" />
                <h2 className="font-semibold">Moderation Queue</h2>
                {(pendingReports ?? 0) > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-semibold">
                    {pendingReports} pending
                  </span>
                )}
              </div>
              <Link href="/admin/moderation" className="text-xs text-primary hover:underline">Open queue →</Link>
            </div>
            <div className="divide-y divide-border">
              {(recentReports ?? []).length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  ✅ No pending reports — queue is clear
                </div>
              ) : (recentReports ?? []).map((r: any) => (
                <div key={r.id} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                  <Flag className="h-3.5 w-3.5 text-orange-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.video?.title ?? 'Unknown video'}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="text-orange-400">{r.reason}</span>
                      {r.reporter?.username && ` · @${r.reporter.username}`}
                      {' · '}{new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {r.video?.id && (
                    <Link href={`/watch/${r.video.id}`} target="_blank" className="text-xs text-primary hover:underline shrink-0">
                      View
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Outstanding credit loans */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-amber-400" />
                <h2 className="font-semibold">Outstanding Loans</h2>
                {totalLoanExposure > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                    ${totalLoanExposure.toFixed(2)} total
                  </span>
                )}
              </div>
              <Link href="/admin/credits?tab=loans" className="text-xs text-primary hover:underline">Manage →</Link>
            </div>
            {(outstandingLoans ?? []).length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">✅ No outstanding loans</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30">
                    <tr>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">User</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground">Loan Balance</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground">Repaid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(outstandingLoans ?? []).map((l: any) => (
                      <tr key={l.user?.username} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-medium">{l.user?.display_name || l.user?.username || '—'}</div>
                          <div className="text-xs text-muted-foreground">@{l.user?.username}</div>
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-amber-400">
                          ${parseFloat(l.loan_balance).toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-right text-green-400 text-xs">
                          ${parseFloat(l.loan_repaid ?? '0').toFixed(2)} repaid
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── All recent comments ──────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-400" />
                <h2 className="font-semibold">Recent Comments</h2>
              </div>
              <Link href="/admin/moderation" className="text-xs text-primary hover:underline">Manage →</Link>
            </div>
            <div className="divide-y divide-border" style={{ maxHeight: 320, overflowY: 'auto' }}>
              {!(recentComments ?? []).length ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">No comments yet</div>
              ) : (recentComments ?? []).map((c: any) => (
                <div key={c.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-semibold text-primary">@{c.author?.username ?? 'unknown'}</span>
                        {c.video && (
                          <a href={`/watch/${c.video.id}`} target="_blank" rel="noopener noreferrer"
                             className="text-xs text-muted-foreground hover:text-primary truncate max-w-[160px] inline-flex items-center gap-0.5">
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            {c.video.title}
                          </a>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3" />
                          {new Date(c.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 line-clamp-2">{c.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Live chat feed ────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-pink-400" />
                <h2 className="font-semibold">Live Chat Feed</h2>
              </div>
              <Link href="/live" className="text-xs text-primary hover:underline">View live →</Link>
            </div>
            <div className="divide-y divide-border" style={{ maxHeight: 280, overflowY: 'auto' }}>
              {!(recentChatMessages ?? []).length ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">No live chat yet</div>
              ) : (recentChatMessages ?? []).map((m: any) => (
                <div key={m.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-semibold text-primary">@{m.sender?.username ?? 'unknown'}</span>
                        {m.stream && (
                          <a href={`/live/${m.stream.id}`} target="_blank" rel="noopener noreferrer"
                             className="text-xs text-muted-foreground hover:text-pink-400 truncate max-w-[140px] inline-flex items-center gap-0.5">
                            <Radio className="h-2.5 w-2.5 shrink-0" />
                            {m.stream.title}
                          </a>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3" />
                          {new Date(m.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 line-clamp-2">{m.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Right column ────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Credit requests summary */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BadgeDollarSign className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Credit Requests</h2>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Pending review', value: (creditStats as any).pending, icon: Clock, color: 'text-yellow-400', urgent: (creditStats as any).pending > 0 },
                { label: 'Approved',       value: (creditStats as any).approved, icon: CheckCircle, color: 'text-green-400' },
                { label: 'Denied',         value: (creditStats as any).denied,   icon: XCircle,     color: 'text-red-400' },
              ].map(({ label, value, icon: Icon, color, urgent }) => (
                <div key={label} className={`flex items-center gap-3 p-3 rounded-xl ${urgent ? 'bg-yellow-500/8 border border-yellow-500/20' : 'bg-muted/30'}`}>
                  <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                  <span className="text-sm flex-1">{label}</span>
                  <span className={`text-sm font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
            <Link href="/admin/credits" className="mt-4 block text-center text-xs text-primary hover:underline font-medium">
              Open Credits Dashboard →
            </Link>
          </div>

          {/* Recent signups */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-green-400" />
                <h2 className="font-semibold">Recent Signups</h2>
              </div>
              <Link href="/admin/users" className="text-xs text-primary hover:underline">All users →</Link>
            </div>
            <div className="divide-y divide-border">
              {!(recentSignups ?? []).length ? (
                <div className="px-5 py-6 text-center text-sm text-muted-foreground">No users yet</div>
              ) : (recentSignups ?? []).map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center text-xs font-bold text-green-400 shrink-0">
                    {((u.display_name ?? u.username ?? '?').charAt(0)).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.display_name ?? u.username}</div>
                    <div className="text-xs text-muted-foreground">
                      @{u.username} · {new Date(u.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {u.role && u.role !== 'user' && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${
                      ROLE_COLORS[u.role] ?? 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {u.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Admin team */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-purple-400" />
                <h2 className="font-semibold">Admin Team</h2>
              </div>
              <Link href="/admin/settings" className="text-xs text-primary hover:underline">Manage →</Link>
            </div>
            <div className="divide-y divide-border">
              {(adminTeam ?? []).map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400 shrink-0">
                    {((m.display_name ?? m.username ?? '?').charAt(0)).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.display_name ?? m.username}</div>
                    <div className="text-xs text-muted-foreground">@{m.username}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${ROLE_COLORS[m.role ?? 'user'] ?? 'bg-muted text-muted-foreground border-border'}`}>
                    {m.role}
                  </span>
                </div>
              ))}
              {!(adminTeam ?? []).length && (
                <div className="px-5 py-6 text-center text-sm text-muted-foreground">No team members</div>
              )}
            </div>
          </div>

          {/* Superadmin quick actions */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-3 text-sm flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              Platform Controls
            </h2>
            <div className="space-y-1.5">
              {[
                { href: '/admin/moderation', label: '🛡️  Moderation Queue',    desc: 'Review flags & reports' },
                { href: '/admin/credits',    label: '💳  Credits Dashboard',   desc: 'Loans, grants, requests' },
                { href: '/admin/users',      label: '👥  User Management',     desc: 'Search, suspend, promote' },
                { href: '/admin/videos',     label: '🎬  Video Management',    desc: 'Review & manage content' },
                { href: '/admin/settings',   label: '⚙️  Team & Permissions',  desc: 'Add mods, manage roles' },
                { href: '/admin/analytics',  label: '📊  Analytics',           desc: 'Platform metrics' },
              ].map(({ href, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium group-hover:text-foreground transition-colors">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                  <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors mt-0.5">→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
