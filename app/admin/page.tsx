import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, Video, Flag, TrendingUp, Activity, DollarSign, Eye, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export const metadata = { title: 'Admin Dashboard', description: 'HapiEats TV platform admin — users, videos, reports, and analytics.' }

export default async function AdminDashboard() {
  const supabase = createClient()

  // Redirect moderators to their own dashboard
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role === 'moderator') redirect('/admin/moderator')
  }

  const service = createServiceClient()

  const [
    { count: userCount },
    { count: videoCount },
    { count: reportCount },
    { count: flaggedCount },
    { count: creatorCount },
    { count: suspendedCount },
    { count: liveCount },
  ] = await Promise.all([
    service.from('profiles').select('*', { count: 'exact', head: true }),
    service.from('videos').select('*', { count: 'exact', head: true }).eq('status', 'ready'),
    service.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending').then(r => ({ count: r.count ?? 0 })),
    service.from('videos').select('*', { count: 'exact', head: true }).eq('is_flagged', true).then(r => ({ count: r.count ?? 0 })),
    service.from('profiles').select('*', { count: 'exact', head: true }).eq('is_creator', true),
    service.from('profiles').select('*', { count: 'exact', head: true }).not('suspended_at', 'is', null),
    service.from('live_streams').select('*', { count: 'exact', head: true }).eq('is_live', true).then(r => ({ count: r.count ?? 0 })),
  ])

  // Recent users
  const { data: recentUsers } = await service
    .from('profiles')
    .select('id, username, display_name, role, is_creator, created_at, suspended_at, avatar_url')
    .order('created_at', { ascending: false })
    .limit(10)

  // Recent videos with thumbnails
  const { data: recentVideos } = await service
    .from('videos')
    .select('id, title, status, is_flagged, visibility, view_count, created_at, mux_playback_id, channel:channels(name, slug), creator:profiles(username, display_name)')
    .order('created_at', { ascending: false })
    .limit(8)

  // Pending reports
  const { data: pendingReports } = await service
    .from('content_reports')
    .select('id, reason, created_at, reporter:profiles!content_reports_reporter_id_fkey(username), video:videos!content_reports_video_id_fkey(title)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5)

  const stats = [
    { label: 'Total Users', value: userCount ?? 0, icon: Users, color: 'text-blue-400', href: '/admin/users' },
    { label: 'Published Videos', value: videoCount ?? 0, icon: Video, color: 'text-green-400', href: '/admin/videos' },
    { label: 'Creators', value: creatorCount ?? 0, icon: TrendingUp, color: 'text-cyan-400', href: '/admin/users' },
    { label: 'Pending Reports', value: reportCount ?? 0, icon: Flag, color: 'text-orange-400', href: '/admin/reports', urgent: (reportCount ?? 0) > 0 },
    { label: 'Flagged Videos', value: flaggedCount ?? 0, icon: ShieldAlert, color: 'text-red-400', href: '/admin/moderation' },
    { label: 'Suspended Users', value: suspendedCount ?? 0, icon: ShieldAlert, color: 'text-yellow-400', href: '/admin/users' },
    { label: 'Live Now', value: liveCount ?? 0, icon: Activity, color: 'text-pink-400', href: '/' },
    { label: 'Views Today', value: '—', icon: Eye, color: 'text-purple-400', href: '/admin/analytics' },
  ]

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Platform overview and quick actions</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {stats.map(({ label, value, icon: Icon, color, href, urgent }) => (
          <Link key={label} href={href ?? '#'} className={`bg-card border rounded-xl p-4 hover:border-primary/40 transition-colors ${urgent ? 'border-orange-500/40' : 'border-border'}`}>
            <div className={`${color} mb-2`}><Icon className="h-4 w-4" /></div>
            <div className="text-xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </Link>
        ))}
      </div>

      {/* Pending reports alert */}
      {(reportCount ?? 0) > 0 && (
        <Link href="/admin/moderation" className="flex items-center gap-3 mb-6 px-4 py-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-sm text-orange-400 hover:bg-orange-500/15 transition-colors">
          <Flag className="h-4 w-4 shrink-0" />
          <span><strong>{reportCount} pending reports</strong> need review in the moderation queue</span>
          <span className="ml-auto text-xs">Review →</span>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Videos */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Recent Videos</h2>
            <Link href="/admin/videos" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-border">
            {(recentVideos ?? []).map(v => {
              const vid = v as any
              const thumb = vid.mux_playback_id
                ? `https://image.mux.com/${vid.mux_playback_id}/thumbnail.jpg?width=120&time=0`
                : null
              return (
                <div key={vid.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                  {/* Thumbnail */}
                  <div className="w-16 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {thumb ? (
                      <Image src={thumb} alt={vid.title} width={64} height={40} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-lg">▶</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/watch/${vid.id}`} className="text-sm font-medium truncate block hover:text-primary">
                      {vid.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {vid.channel?.name ?? vid.creator?.display_name ?? vid.creator?.username}
                      {' · '}{new Date(vid.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {vid.is_flagged && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">flagged</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      vid.status === 'ready' ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'
                    }`}>{vid.status}</span>
                  </div>
                </div>
              )
            })}
            {!recentVideos?.length && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">No videos uploaded yet</div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Recent Users */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold">Recent Users</h2>
              <Link href="/admin/users" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            <div className="divide-y divide-border">
              {(recentUsers ?? []).map(u => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                    {(u.display_name ?? u.username ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.display_name ?? u.username ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">@{u.username}</div>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    u.suspended_at ? 'bg-red-500/10 text-red-400' :
                    u.role === 'superadmin' ? 'bg-purple-500/10 text-purple-400' :
                    u.role === 'admin' ? 'bg-primary/10 text-primary' :
                    u.role === 'moderator' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {u.suspended_at ? 'suspended' : u.role}
                  </span>
                </div>
              ))}
              {!recentUsers?.length && (
                <div className="px-5 py-6 text-center text-sm text-muted-foreground">No users yet</div>
              )}
            </div>
          </div>

          {/* Pending Reports */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold">Pending Reports</h2>
              <Link href="/admin/moderation" className="text-xs text-primary hover:underline">Review →</Link>
            </div>
            <div className="divide-y divide-border">
              {(pendingReports ?? []).map(r => {
                const rep = r as any
                return (
                  <div key={rep.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="text-sm font-medium truncate">{rep.video?.title ?? 'Unknown video'}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <span className="text-orange-400 font-medium">{rep.reason}</span>
                      {' · '}by @{rep.reporter?.username ?? 'unknown'}
                    </div>
                  </div>
                )
              })}
              {!pendingReports?.length && (
                <div className="px-5 py-6 text-center text-sm text-muted-foreground">Queue is clear ✓</div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-sm">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { href: '/admin/settings', label: '⚙️  Platform Settings' },
                { href: '/admin/moderation', label: '🛡️  Moderation Queue' },
                { href: '/admin/credits', label: '💳  Credits Dashboard' },
                { href: '/admin/users', label: '👥  Manage All Users' },
                { href: '/admin/videos', label: '🎬  Manage All Videos' },
                { href: '/admin/analytics', label: '📊  View Analytics' },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
