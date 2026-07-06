import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import { redirect, notFound } from 'next/navigation'
import CourseEditor from '@/components/courses/CourseEditor'

export const dynamic = 'force-dynamic'

export default async function CourseEditorPage({ params }: { params: { id: string } }) {
  const authClient = createClient()
  const supabase = createServiceClient()

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect(`/login?next=/creator/courses/${params.id}`)

  const { data: course } = await supabase
    .from('courses')
    .select(`
      *,
      sections:course_sections(
        id, title, position,
        lessons:course_lessons(
          id, title, description, duration_seconds, mux_playback_id, mux_asset_id,
          lesson_type, is_preview, position, live_scheduled_at
        )
      )
    `)
    .eq('id', params.id)
    .eq('creator_id', user.id) // Security: only creator can edit
    .single()

  if (!course) notFound()

  const sections = (course.sections ?? [])
    .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
    .map((s: { lessons: { position: number }[] }) => ({
      ...s,
      lessons: s.lessons.sort((a, b) => a.position - b.position),
    }))

  return (
    <AppShell>
      <CourseEditor course={course} sections={sections} />
    </AppShell>
  )
}
