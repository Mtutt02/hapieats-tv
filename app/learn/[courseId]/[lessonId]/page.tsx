import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import { redirect, notFound } from 'next/navigation'
import LessonPlayer from '@/components/courses/LessonPlayer'

export const dynamic = 'force-dynamic'

export default async function LessonPage({
  params,
}: {
  params: { courseId: string; lessonId: string }
}) {
  const authClient = createClient()
  const supabase = createServiceClient()

  // ── Auth ────────────────────────────────────────────────────────────────────
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    redirect(`/login?next=/learn/${params.courseId}/${params.lessonId}`)
  }

  // ── Fetch lesson (server-side — Mux playback ID never exposed without auth) ─
  const { data: lesson } = await supabase
    .from('course_lessons')
    .select('*, course:courses(id, title, creator_id, status)')
    .eq('id', params.lessonId)
    .single()

  if (!lesson) notFound()

  const course = lesson.course as { id: string; title: string; creator_id: string; status: string } | null
  if (!course || course.status !== 'published') notFound()

  const isCreator = course.creator_id === user.id

  // ── Enrollment check (skip for preview lessons and creators) ────────────────
  if (!isCreator && !lesson.is_preview) {
    const { data: enrollment } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('course_id', params.courseId)
      .eq('user_id', user.id)
      .single()

    if (!enrollment) {
      // Not enrolled — redirect to course page with paywall
      redirect(`/courses/${params.courseId}?locked=1`)
    }
  }

  // ── Fetch full curriculum for sidebar (exclude live_stream_key — never select it) ─
  const { data: sections } = await supabase
    .from('course_sections')
    .select(`
      id, title, position,
      lessons:course_lessons(id, title, duration_seconds, is_preview, lesson_type, position)
    `)
    .eq('course_id', params.courseId)
    .order('position')

  const sortedSections = (sections ?? []).map((s) => ({
    ...s,
    lessons: (s.lessons as { position: number }[]).sort((a, b) => a.position - b.position),
  }))

  // ── User progress ──────────────────────────────────────────────────────────
  const { data: progress } = await supabase
    .from('lesson_progress')
    .select('lesson_id, completed, progress_seconds')
    .eq('user_id', user.id)
    .eq('lesson_id', params.lessonId)
    .single()

  return (
    <AppShell fullWidth>
      <LessonPlayer
        lesson={{
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
          muxPlaybackId: lesson.mux_playback_id,
          lessonType: lesson.lesson_type,
          liveScheduledAt: lesson.live_scheduled_at,
        }}
        course={{ id: course.id, title: course.title }}
        sections={sortedSections}
        currentLessonId={params.lessonId}
        initialProgress={progress?.progress_seconds ?? 0}
      />
    </AppShell>
  )
}
