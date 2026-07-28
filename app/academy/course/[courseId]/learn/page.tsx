import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Course, CourseSection, CourseLesson, Recipe } from '@/lib/academy/types'
import ClassroomClient from '@/components/academy/player/ClassroomClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Classroom — HapiEats Academy',
  robots: { index: false },
}

function mapRecipe(r: Record<string, unknown> | undefined): Recipe | null {
  if (!r) return null
  return {
    id: r.id as string,
    course_id: r.course_id as string,
    lesson_id: (r.lesson_id as string | null) ?? null,
    title: r.title as string,
    is_master: !!r.is_master,
    servings: (r.servings as number | null) ?? null,
    prep_minutes: (r.prep_minutes as number | null) ?? null,
    cook_minutes: (r.cook_minutes as number | null) ?? null,
    ingredients: Array.isArray(r.ingredients) ? (r.ingredients as Recipe['ingredients']) : [],
    steps: Array.isArray(r.steps) ? (r.steps as string[]) : [],
    notes: (r.notes as string | null) ?? null,
  }
}

export default async function ClassroomPage({
  params,
  searchParams,
}: {
  params: { courseId: string }
  searchParams: { lesson?: string }
}) {
  const courseId = params.courseId
  const authClient = createClient()
  const service = createServiceClient()

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    redirect(`/login?next=/academy/course/${courseId}/learn`)
  }

  const { data: course } = await service.from('courses').select('*').eq('id', courseId).single()
  if (!course) notFound()

  // ── Access gate: creator OR enrolled OR (pro-accessible && Pro member) ──
  let access = user.id === course.creator_id
  if (!access) {
    const { data: enroll } = await service
      .from('course_enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .maybeSingle()
    access = !!enroll
  }
  if (!access && (course.pricing_model === 'pro_only' || course.pro_included)) {
    const { data: isPro } = await service.rpc('is_pro_member', { p_user_id: user.id })
    access = isPro === true
  }
  if (!access) {
    // Not entitled — send back to the sales/landing page to enroll.
    redirect(`/academy/course/${courseId}`)
  }

  // ── Curriculum (full — access already verified) ──
  const { data: sectionRows } = await service
    .from('course_sections')
    .select('id, course_id, title, position')
    .eq('course_id', courseId)
    .order('position', { ascending: true })

  const sectionIds = (sectionRows ?? []).map((s) => s.id)
  let lessonRows: Record<string, unknown>[] = []
  if (sectionIds.length) {
    const { data } = await service
      .from('course_lessons')
      .select('id, section_id, title, description, mux_playback_id, position, is_preview, duration, resources, chapters')
      .in('section_id', sectionIds)
      .order('position', { ascending: true })
    lessonRows = data ?? []
  }

  const { data: recipeRows } = await service
    .from('lesson_recipes')
    .select('*')
    .eq('course_id', courseId)
  const recipeByLesson = new Map<string, Record<string, unknown>>()
  for (const r of recipeRows ?? []) {
    if ((r as { lesson_id?: string }).lesson_id) {
      recipeByLesson.set((r as { lesson_id: string }).lesson_id, r as Record<string, unknown>)
    }
  }

  const sections: CourseSection[] = (sectionRows ?? []).map((s) => ({
    id: s.id,
    course_id: s.course_id,
    title: s.title,
    order_index: s.position ?? 0,
    lessons: lessonRows
      .filter((l) => (l as { section_id: string }).section_id === s.id)
      .map(
        (l): CourseLesson => ({
          id: (l as { id: string }).id,
          section_id: (l as { section_id: string }).section_id,
          title: (l as { title: string }).title,
          description: ((l as { description?: string | null }).description) ?? null,
          video_id: null,
          mux_playback_id: ((l as { mux_playback_id?: string | null }).mux_playback_id) ?? null,
          order_index: ((l as { position?: number }).position) ?? 0,
          is_free_preview: !!(l as { is_preview?: boolean }).is_preview,
          duration: ((l as { duration?: number | null }).duration) ?? null,
          resources: Array.isArray((l as { resources?: unknown }).resources)
            ? ((l as { resources: CourseLesson['resources'] }).resources)
            : [],
          chapters: Array.isArray((l as { chapters?: unknown }).chapters)
            ? ((l as { chapters: CourseLesson['chapters'] }).chapters)
            : [],
          recipe: mapRecipe(recipeByLesson.get((l as { id: string }).id)),
        }),
      ),
  }))

  // ── Completed lesson ids (progress checkmarks) from the engagement ledger ──
  const { data: engagement } = await service
    .from('academy_engagement')
    .select('lesson_id, completed')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .eq('completed', true)
  const completedIds = Array.from(
    new Set((engagement ?? []).map((e) => e.lesson_id as string).filter(Boolean)),
  )

  // ── Existing certificate (so CompletionCard links straight to /verify) ──
  const { data: cert } = await service
    .from('course_certificates')
    .select('verification_code')
    .eq('course_id', courseId)
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <ClassroomClient
      course={course as Course}
      sections={sections}
      initialCompletedIds={completedIds}
      initialLessonId={searchParams?.lesson ?? null}
      certificateCode={(cert as { verification_code?: string } | null)?.verification_code ?? null}
    />
  )
}
