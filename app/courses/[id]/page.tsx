import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import { notFound } from 'next/navigation'
import CourseDetail from '@/components/courses/CourseDetail'

export const dynamic = 'force-dynamic'

export default async function CourseDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const authClient = createClient()

  // Auth (may be null — public page)
  const { data: { user } } = await authClient.auth.getUser()

  // Fetch course
  const { data: course } = await supabase
    .from('courses')
    .select(`
      *,
      creator:profiles!creator_id(id, username, display_name, avatar_url, bio),
      sections:course_sections(
        id, title, position,
        lessons:course_lessons(
          id, title, description, duration_seconds, is_preview, lesson_type,
          position, live_scheduled_at
        )
      )
    `)
    .eq('id', params.id)
    .eq('status', 'published')
    .single()

  if (!course) notFound()

  // Sort sections and lessons by position
  const sections = (course.sections ?? [])
    .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
    .map((s: { lessons: { position: number }[] }) => ({
      ...s,
      lessons: s.lessons.sort((a, b) => a.position - b.position),
    }))

  // Check enrollment status
  let isEnrolled = false
  if (user) {
    const { data: enrollment } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('course_id', params.id)
      .eq('user_id', user.id)
      .single()
    isEnrolled = !!enrollment
  }

  // Check if user is the creator
  const isCreator = user?.id === (course.creator as { id: string } | null)?.id

  return (
    <AppShell>
      <CourseDetail
        course={course}
        sections={sections}
        isEnrolled={isEnrolled || isCreator}
        isCreator={isCreator}
        userId={user?.id ?? null}
      />
    </AppShell>
  )
}
