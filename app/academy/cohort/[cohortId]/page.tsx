import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import Classroom from '@/components/academy/Classroom'

export const dynamic = 'force-dynamic'

export default async function CohortClassroomPage({
  params,
}: {
  params: { cohortId: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/academy/cohort/${params.cohortId}`)

  const service = createServiceClient()

  const { data: cohort } = await service
    .from('cohorts')
    .select('id, course_id, title, starts_at, ends_at, capacity, live_stream_id, status')
    .eq('id', params.cohortId)
    .single()
  if (!cohort) notFound()

  const { data: course } = await service
    .from('courses')
    .select('id, creator_id, title, category, level')
    .eq('id', cohort.course_id)
    .single()
  if (!course) notFound()

  const isInstructor = course.creator_id === user.id

  // Gate: instructor OR an enrolled cohort member.
  let isMember = false
  if (!isInstructor) {
    const { data: m } = await service
      .from('cohort_members')
      .select('user_id')
      .eq('cohort_id', cohort.id)
      .eq('user_id', user.id)
      .maybeSingle()
    isMember = !!m
  }
  if (!isInstructor && !isMember) {
    redirect(`/academy/courses/${cohort.course_id}`)
  }

  // Resolve the live stream's playback id (stream_key deliberately excluded).
  let playbackId: string | null = null
  let streamStatus: string | null = null
  if (cohort.live_stream_id) {
    const { data: ls } = await service
      .from('live_streams')
      .select('mux_playback_id, status')
      .eq('id', cohort.live_stream_id)
      .maybeSingle()
    playbackId = ls?.mux_playback_id ?? null
    streamStatus = ls?.status ?? null
  }

  const { count: memberCount } = await service
    .from('cohort_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('cohort_id', cohort.id)

  const { data: profile } = await service
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', user.id)
    .single()

  return (
    <Classroom
      cohort={{
        id: cohort.id,
        courseId: cohort.course_id,
        title: cohort.title,
        startsAt: cohort.starts_at,
        endsAt: cohort.ends_at,
        status: cohort.status,
      }}
      course={{ id: course.id, title: course.title, level: course.level }}
      playbackId={playbackId}
      streamStatus={streamStatus}
      isInstructor={isInstructor}
      memberCount={memberCount ?? 0}
      currentUser={{
        id: user.id,
        username: profile?.username ?? 'chef',
        displayName: profile?.display_name ?? profile?.username ?? 'Chef',
        avatarUrl: profile?.avatar_url ?? null,
      }}
    />
  )
}
