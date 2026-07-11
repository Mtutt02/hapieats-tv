import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Course, CourseSection, CourseLesson, PricingModel } from '@/lib/academy/types'
import EnrollButton from './EnrollButton'
import PreviewLesson from './PreviewLesson'

export const dynamic = 'force-dynamic'

interface Instructor {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
}

// Fetch course + sections + lessons (raw rows mapped to the contract) via service client.
async function loadCourse(courseId: string): Promise<{
  course: Course
  instructor: Instructor | null
  sections: CourseSection[]
} | null> {
  const service = createServiceClient()

  const { data: course } = await service.from('courses').select('*').eq('id', courseId).single()
  if (!course) return null

  const isPublished = course.is_published === true || course.status === 'published'
  if (!isPublished) return null

  const { data: instructor } = await service
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio')
    .eq('id', course.creator_id)
    .maybeSingle()

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
      .select('id, section_id, title, description, mux_playback_id, position, is_preview, duration')
      .in('section_id', sectionIds)
      .order('position', { ascending: true })
    lessonRows = data ?? []
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
          resources: [],
          chapters: [],
        }),
      ),
  }))

  return { course: course as Course, instructor: (instructor as Instructor) ?? null, sections }
}

// Determine whether the caller already has full access to this course.
async function hasFullAccess(course: Course, userId: string | null): Promise<boolean> {
  if (!userId) return false
  if (userId === course.creator_id) return true
  const service = createServiceClient()
  const { data: enroll } = await service
    .from('course_enrollments')
    .select('id')
    .eq('course_id', course.id)
    .eq('user_id', userId)
    .maybeSingle()
  if (enroll) return true
  if (course.pricing_model === 'pro_only' || course.pro_included) {
    const { data: isPro } = await service.rpc('is_pro_member', { p_user_id: userId })
    if (isPro === true) return true
  }
  return false
}

export async function generateMetadata({ params }: { params: { courseId: string } }): Promise<Metadata> {
  const loaded = await loadCourse(params.courseId)
  if (!loaded) return { title: 'Course not found — HapiEats Academy' }
  const { course } = loaded
  const title = `${course.title} — HapiEats Academy`
  const description = course.description ?? 'Learn to cook with HapiEats Academy.'
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: course.thumbnail_url ? [{ url: course.thumbnail_url }] : undefined,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

function priceLabel(model: PricingModel, price: number, proIncluded: boolean): string {
  if (model === 'free') return 'Free'
  if (model === 'pro_only') return 'Included with HapiEats Pro'
  if (proIncluded) return `$${price.toFixed(2)} · or go Pro`
  return `$${price.toFixed(2)}`
}

function fmtDuration(sec: number | null): string {
  if (!sec || sec <= 0) return ''
  const m = Math.round(sec / 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}

export default async function CourseLandingPage({ params }: { params: { courseId: string } }) {
  const loaded = await loadCourse(params.courseId)
  if (!loaded) notFound()
  const { course, instructor, sections } = loaded

  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()

  // Enrolled / creator / Pro → send straight to the classroom.
  if (await hasFullAccess(course, user?.id ?? null)) {
    redirect(`/academy/course/${course.id}/learn`)
  }

  const instructorName = instructor?.display_name ?? instructor?.username ?? 'HapiEats Chef'
  const totalLessons = sections.reduce((n, s) => n + s.lessons.length, 0)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Hero */}
      <section className="border-b border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 md:grid-cols-2 md:items-center">
          <div className="order-2 md:order-1">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs capitalize text-zinc-300">
                {course.level}
              </span>
              <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs capitalize text-zinc-300">
                {course.format}
              </span>
              <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs capitalize text-zinc-300">
                {course.category}
              </span>
            </div>
            <h1 className="text-2xl font-bold md:text-3xl">{course.title}</h1>
            {course.description && <p className="mt-3 text-zinc-400">{course.description}</p>}
            <div className="mt-4 flex items-center gap-3 text-sm text-zinc-400">
              <span>Instructor: <span className="text-zinc-200">{instructorName}</span></span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400">★ ★ ★ ★ ★</span>
              <span className="text-zinc-500">(new)</span>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <span className="text-xl font-semibold">
                {priceLabel(course.pricing_model as PricingModel, Number(course.price ?? 0), course.pro_included)}
              </span>
              <EnrollButton
                courseId={course.id}
                pricingModel={course.pricing_model as PricingModel}
                proIncluded={course.pro_included}
                price={Number(course.price ?? 0)}
                signedIn={!!user}
              />
            </div>
          </div>
          <div className="order-1 md:order-2">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              {course.thumbnail_url ? (
                <Image src={course.thumbnail_url} alt={course.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-600">HapiEats Academy</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* What you'll learn */}
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">What you&apos;ll learn</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {sections.slice(0, 6).map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-0.5 text-emerald-400" aria-hidden="true">✓</span>
                {s.title}
              </li>
            ))}
          </ul>
        </section>

        {/* Curriculum */}
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Curriculum</h2>
            <span className="text-sm text-zinc-500">
              {sections.length} sections · {totalLessons} lessons
            </span>
          </div>
          <div className="space-y-4">
            {sections.map((section) => (
              <div key={section.id} className="overflow-hidden rounded-lg border border-zinc-800">
                <div className="bg-zinc-900 px-4 py-3 text-sm font-semibold">{section.title}</div>
                <ul className="divide-y divide-zinc-800">
                  {section.lessons.map((lesson) => {
                    const locked = !lesson.is_free_preview
                    const inner = (
                      <div className="flex items-center gap-3 px-4 py-3 text-sm">
                        <span className="flex-none text-zinc-500" aria-hidden="true">
                          {locked ? '🔒' : '▶'}
                        </span>
                        <span className={`flex-1 ${locked ? 'text-zinc-400' : 'text-zinc-100'}`}>
                          {lesson.title}
                          {lesson.is_free_preview && (
                            <span className="ml-2 rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10px] uppercase text-emerald-300">
                              free preview
                            </span>
                          )}
                        </span>
                        {fmtDuration(lesson.duration) && (
                          <span className="flex-none text-xs text-zinc-500">{fmtDuration(lesson.duration)}</span>
                        )}
                      </div>
                    )
                    // Free-preview lessons are playable in the classroom.
                    return (
                      <li key={lesson.id}>
                        {lesson.is_free_preview ? (
                          <PreviewLesson lesson={lesson}>{inner}</PreviewLesson>
                        ) : (
                          inner
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
