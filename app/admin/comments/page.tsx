import type { Metadata } from 'next'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CommentsClient from './CommentsClient'

export const metadata: Metadata = { title: 'Comments', description: 'Moderate comments across HapiEats TV.' }

export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin/comments')

  const { data: me } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  if (!me || !['admin', 'superadmin', 'moderator'].includes(me.role ?? '')) {
    redirect('/?error=unauthorized')
  }

  const params = await searchParams
  const searchQuery = typeof params.search === 'string' ? params.search : ''

  const service = createServiceClient()

  // Fetch comments with author and video info
  let query = service
    .from('comments')
    .select(`
      id, body, created_at, updated_at,
      author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url),
      video:videos!comments_video_id_fkey(id, title, is_flagged, view_count)
    `, { count: 'exact' })

  if (searchQuery) {
    query = query.ilike('body', `%${searchQuery}%`)
  }

  const { data: comments, count: totalCount } = await query
    .order('created_at', { ascending: false })
    .limit(100)

  // Also fetch comment reports for pending moderation
  const { data: commentReports } = await service
    .from('content_reports')
    .select('id, reason, status, comment_id, created_at')
    .not('comment_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  // Build a map of comment_id -> pending report
  const reportMap = new Map<string, { id: string; reason: string; created_at: string }>()
  for (const r of commentReports ?? []) {
    if (r.status === 'pending' && r.comment_id && !reportMap.has(r.comment_id)) {
      reportMap.set(r.comment_id, { id: r.id, reason: r.reason, created_at: r.created_at })
    }
  }

  const typedComments = (comments ?? []) as any[]
  const typedReportMap = Object.fromEntries(reportMap)

  return (
    <CommentsClient
      comments={typedComments}
      totalCount={totalCount ?? 0}
      reportMap={typedReportMap}
      searchQuery={searchQuery}
    />
  )
}
