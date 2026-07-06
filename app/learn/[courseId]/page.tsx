import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * /learn/[courseId] — redirect to first lesson.
 * Called after free enrollment or Stripe checkout success_url.
 */
export default async function LearnCoursePage({ params }: { params: { courseId: string } }) {
  const authClient = createClient()
  const supabase = createServiceClient()

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    redirect(`/login?next=/learn/${params.courseId}`)
  }

  // Find the first lesson in the course
  const { data: sections } = await supabase
    .from('course_sections')
    .select('id, position, lessons:course_lessons(id, position)')
    .eq('course_id', params.courseId)
    .order('position')

  if (!sections?.length) {
    // Course exists but no lessons yet — send to course detail
    redirect(`/courses/${params.courseId}`)
  }

  const sortedSections = sections.sort((a, b) => a.position - b.position)
  const firstSection = sortedSections[0]
  const lessons = (firstSection.lessons as { id: string; position: number }[])
    .sort((a, b) => a.position - b.position)

  if (!lessons.length) {
    redirect(`/courses/${params.courseId}`)
  }

  const firstLesson = lessons[0]
  redirect(`/learn/${params.courseId}/${firstLesson.id}`)
}
