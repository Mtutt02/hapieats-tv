import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ModerationClient from './ModerationClient'

export const metadata = { title: 'Moderation Queue', description: 'Review and action flagged content on HapiEats TV.' }

export default async function ModerationPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin/moderation')

  const { data: me } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  if (!me || !['admin', 'superadmin', 'moderator'].includes(me.role ?? '')) {
    redirect('/?error=unauthorized')
  }

  const service = createServiceClient()

  // Pending reports with video + reporter info
  const { data: reports } = await service
    .from('content_reports')
    .select(`
      id, reason, detail, status, created_at,
      reporter:profiles!content_reports_reporter_id_fkey(id, username, display_name),
      video:videos!content_reports_video_id_fkey(id, title, visibility, is_flagged, mux_playback_id,
        channel:channels(name, slug)
      )
    `)
    .in('status', ['pending', 'reviewed'])
    .order('created_at', { ascending: false })
    .limit(50)

  // Stats + recent comments in parallel
  const [
    { count: pendingCount },
    { count: reviewedTodayCount },
    { count: flaggedVideosCount },
    { count: suspendedCount },
    { data: comments },
  ] = await Promise.all([
    service.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    service.from('content_reports').select('*', { count: 'exact', head: true })
      .eq('status', 'actioned')
      .gte('reviewed_at', new Date(Date.now() - 86400000).toISOString()),
    service.from('videos').select('*', { count: 'exact', head: true }).eq('is_flagged', true),
    service.from('profiles').select('*', { count: 'exact', head: true }).not('suspended_at', 'is', null),
    service
      .from('comments')
      .select(`
        id, body, created_at,
        author:profiles!comments_author_id_fkey(id, username, display_name),
        video:videos!comments_video_id_fkey(id, title)
      `)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedReports = (reports ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedComments = (comments ?? []) as any[]

  return (
    <ModerationClient
      reports={typedReports}
      comments={typedComments}
      stats={{
        pending: pendingCount ?? 0,
        actionedToday: reviewedTodayCount ?? 0,
        flaggedVideos: flaggedVideosCount ?? 0,
        suspended: suspendedCount ?? 0,
      }}
      moderatorRole={me.role ?? 'moderator'}
    />
  )
}
