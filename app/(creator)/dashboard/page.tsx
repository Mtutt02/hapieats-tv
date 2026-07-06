import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Creator Dashboard',
  description: 'View your videos, stats, earnings, and live streams on HapiEats TV.',
}
import DashboardStats from '@/components/creator/DashboardStats'
import VideoCard from '@/components/video/VideoCard'
import type { Video, CreatorStats } from '@/types'
import { Radio, Clock, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

function LiveStreamBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold tracking-wide animate-pulse">
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
        LIVE
      </span>
    )
  }
  if (status === 'ended') {
    return (
      <span className="px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300 text-[10px] font-medium">
        Ended
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 text-[10px] font-medium">
      {status}
    </span>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/dashboard')

  // Videos — include creator + channel for VideoCard
  const { data: videos } = await supabase
    .from('videos')
    .select(`
      *,
      channel:channels(id, name, slug, thumbnail_url),
      creator:profiles(id, username, display_name, avatar_url)
    `)
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })

  // Live streams — most recent 10
  const { data: liveStreams } = await supabase
    .from('live_streams')
    .select('id, title, status, started_at, ended_at, mux_playback_id')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Aggregate stats
  const totalViews  = (videos ?? []).reduce((s, v) => s + (v.view_count ?? 0), 0)

  const { data: purchases } = await supabase
    .from('purchases')
    .select('amount, video:videos!inner(creator_id)')
    .eq('video.creator_id', user.id)

  const totalRevenue = (purchases ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)

  const { data: channel } = await supabase
    .from('channels')
    .select('id, subscriber_count')
    .eq('creator_id', user.id)
    .single()

  const stats: CreatorStats = {
    total_views:        totalViews,
    total_revenue:      totalRevenue,
    subscriber_count:   channel?.subscriber_count ?? 0,
    video_count:        videos?.length ?? 0,
    views_this_month:   0,
    revenue_this_month: 0,
  }

  const hasLive   = (liveStreams?.length ?? 0) > 0
  const hasVideos = (videos?.length ?? 0) > 0

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Creator Dashboard</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/studio/go-live"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/50 bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition"
            >
              <Radio className="h-4 w-4" /> Go Live
            </Link>
            <Link
              href="/studio/upload"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition"
            >
              + Upload Video
            </Link>
          </div>
        </div>

        <DashboardStats stats={stats} />

        {/* ── Live Streams ──────────────────────────────────────── */}
        {hasLive && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Radio className="h-5 w-5 text-red-400" />
                Live Streams
              </h2>
              <Link
                href="/studio/go-live"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                New stream <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="rounded-2xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stream</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                      <Clock className="h-3.5 w-3.5 inline mr-1" />Time
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(liveStreams ?? []).map(ls => (
                    <tr key={ls.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium truncate max-w-[200px]">
                        {ls.title || 'Untitled stream'}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <LiveStreamBadge status={ls.status ?? 'idle'} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                        {ls.started_at
                          ? formatDistanceToNow(new Date(ls.started_at), { addSuffix: true })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {ls.status === 'active' ? (
                          <Link
                            href={`/live/${ls.id}`}
                            className="text-xs text-red-400 hover:text-red-300 font-medium"
                          >
                            Watch live →
                          </Link>
                        ) : ls.mux_playback_id ? (
                          <Link
                            href={`/live/${ls.id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            View recording →
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">No recording</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Videos grid ──────────────────────────────────────── */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your Videos</h2>
            {hasVideos && (
              <Link href="/studio/videos" className="text-sm text-primary hover:underline flex items-center gap-1">
                Manage all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {!hasVideos ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
              <p>No videos yet.</p>
              <Link href="/studio/upload" className="text-primary font-medium text-sm mt-2 inline-block">
                Upload your first video →
              </Link>
            </div>
          ) : (
            <>
              {/* Status legend */}
              <div className="flex gap-3 mb-4 flex-wrap text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-green-500" />ready
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />processing
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />uploading
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" />errored
                </span>
              </div>

              {/* Video card grid — VideoCard has hover preview built-in */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-7">
                {(videos as Video[]).map(v => (
                  <div key={v.id} className="relative">
                    {/* Status dot overlay */}
                    <div className="absolute top-2 left-2 z-10">
                      <span className={`h-2.5 w-2.5 rounded-full block ${
                        v.status === 'ready'      ? 'bg-green-500' :
                        v.status === 'processing' ? 'bg-yellow-500' :
                        v.status === 'uploading'  ? 'bg-blue-500 animate-pulse' :
                        'bg-red-500'
                      }`} />
                    </div>
                    <VideoCard video={v} />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Empty state — no live OR videos */}
        {!hasLive && !hasVideos && (
          <div className="mt-10 rounded-2xl border border-dashed p-12 text-center space-y-4">
            <p className="text-muted-foreground">Nothing here yet — start creating!</p>
            <div className="flex gap-3 justify-center">
              <Link href="/studio/upload" className="text-primary font-medium text-sm hover:underline">
                Upload a video →
              </Link>
              <span className="text-muted-foreground">or</span>
              <Link href="/studio/go-live" className="text-red-400 font-medium text-sm hover:underline">
                Go live →
              </Link>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  )
}
