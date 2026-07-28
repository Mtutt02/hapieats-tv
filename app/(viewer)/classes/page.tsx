import type { Metadata } from 'next'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import Link from 'next/link'
import Image from 'next/image'
import { GraduationCap, BookOpen, Users, Clock, Play, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Cooking Classes',
  description: 'Learn from expert chefs and home cooks. Browse live, recorded, and hybrid cooking classes on HapiEats TV.',
}

interface PageProps {
  searchParams: { type?: string; category?: string; level?: string }
}

// Filters map onto the unified course backend:
//   type  → courses.format   (recorded | live | hybrid)
//   level → courses.level     (beginner | intermediate | advanced | professional)
//   category → courses.category
const types = [
  { value: '', label: 'All' },
  { value: 'recorded', label: 'Recorded' },
  { value: 'live', label: 'Live' },
  { value: 'hybrid', label: 'Live + Recorded' },
]

const categories = [
  { value: '', label: 'All' },
  { value: 'baking', label: 'Baking' },
  { value: 'cooking', label: 'Cooking' },
  { value: 'pastry', label: 'Pastry' },
  { value: 'grilling', label: 'Grilling' },
  { value: 'international', label: 'International' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'nutrition', label: 'Nutrition' },
]

const levels = [
  { value: '', label: 'All Levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'professional', label: 'Pro' },
]

const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-green-500/20 text-green-400',
  intermediate: 'bg-yellow-500/20 text-yellow-400',
  advanced: 'bg-red-500/20 text-red-400',
  professional: 'bg-indigo-500/20 text-indigo-300',
}

function buildParams(current: Record<string, string | undefined>, update: Record<string, string>) {
  const params = new URLSearchParams()
  const merged = { ...current, ...update }
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v)
  }
  return params.toString() ? `?${params.toString()}` : ''
}

function formatDuration(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default async function ClassesPage({ searchParams }: PageProps) {
  const authClient = createClient()
  const supabase   = createServiceClient()
  const { type, category, level } = searchParams
  const { data: { user } } = await authClient.auth.getUser()

  // ── Enrolled courses + progress (logged-in only) ──────────────────────────
  type EnrolledEntry = {
    courseId: string
    course: { id: string; title: string; thumbnail_url: string | null; lesson_count: number; total_duration_seconds: number; level: string | null }
    completedLessons: number
    lastLessonId: string | null
  }
  let enrolled: EnrolledEntry[] = []

  if (user) {
    const { data: enrollments } = await supabase
      .from('course_enrollments')
      .select('course_id, course:courses(id, title, thumbnail_url, lesson_count, total_duration_seconds, level)')
      .eq('user_id', user.id)
      .limit(20)

    if (enrollments && enrollments.length > 0) {
      const courseIds = enrollments.map(e => e.course_id)

      // Get all sections then lessons to find lesson IDs per course
      const { data: sections } = await supabase
        .from('course_sections')
        .select('id, course_id')
        .in('course_id', courseIds)
      const sectionIds = (sections ?? []).map(s => s.id)

      const { data: lessons } = sectionIds.length > 0
        ? await supabase
            .from('course_lessons')
            .select('id, section_id, position')
            .in('section_id', sectionIds)
            .order('position')
        : { data: [] }

      // Map section → course
      const sectionToCourse = new Map<string, string>()
      for (const s of sections ?? []) sectionToCourse.set(s.id, s.course_id)

      // Group lesson IDs per course
      const lessonsByCourse = new Map<string, { id: string; position: number }[]>()
      for (const l of lessons ?? []) {
        const cid = sectionToCourse.get((l as { section_id: string }).section_id)
        if (!cid) continue
        if (!lessonsByCourse.has(cid)) lessonsByCourse.set(cid, [])
        lessonsByCourse.get(cid)!.push({ id: l.id, position: (l as { position: number }).position ?? 0 })
      }

      const allLessonIds = (lessons ?? []).map(l => l.id)
      const { data: progress } = allLessonIds.length > 0
        ? await supabase
            .from('lesson_progress')
            .select('lesson_id, completed, progress_seconds, updated_at')
            .eq('user_id', user.id)
            .in('lesson_id', allLessonIds)
            .order('updated_at', { ascending: false })
        : { data: [] }

      const progressMap = new Map((progress ?? []).map(p => [p.lesson_id, p]))

      enrolled = enrollments
        .filter(e => e.course)
        .map(e => {
          const cls = e.course as EnrolledEntry['course']
          const courseLessons = (lessonsByCourse.get(e.course_id) ?? []).sort((a, b) => a.position - b.position)
          const completedLessons = courseLessons.filter(l => progressMap.get(l.id)?.completed).length

          // Last-touched lesson: most recent progress, or first incomplete, or first
          const touched = courseLessons
            .filter(l => progressMap.has(l.id))
            .sort((a, b) => {
              const at = progressMap.get(a.id)?.updated_at ?? ''
              const bt = progressMap.get(b.id)?.updated_at ?? ''
              return bt.localeCompare(at)
            })
          const lastLessonId =
            touched[0]?.id ??
            courseLessons.find(l => !progressMap.get(l.id)?.completed)?.id ??
            courseLessons[0]?.id ??
            null

          return { courseId: e.course_id, course: cls, completedLessons, lastLessonId }
        })
    }
  }

  const enrolledIds = new Set(enrolled.map(e => e.courseId))

  let query = supabase
    .from('courses')
    .select(`
      id, title, description, thumbnail_url, pricing_model, price_usd,
      lesson_count, enrollment_count, total_duration_seconds, level, category, format,
      creator:profiles!creator_id(id, username, display_name, avatar_url)
    `)
    .eq('status', 'published')
    .order('enrollment_count', { ascending: false })

  if (type) query = query.eq('format', type)
  if (category) query = query.eq('category', category)
  if (level) query = query.eq('level', level)

  const { data: classes } = await query.limit(48)
  const currentParams = { type, category, level }

  // Filter browse grid to exclude already-enrolled courses
  const browseClasses = (classes ?? []).filter(c => !enrolledIds.has(c.id))

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-10">
        {/* Header */}
        <div className="mb-2">
          <div className="flex items-center gap-3 mb-1">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Cooking Classes</h1>
          </div>
          <p className="text-muted-foreground text-lg">Learn from expert chefs and home cooks</p>
        </div>

        {/* ── My Learning ──────────────────────────────────────────────────── */}
        {enrolled.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Play className="h-5 w-5 text-primary" /> My Learning
              </h2>
              <span className="text-sm text-zinc-500">{enrolled.length} enrolled</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {enrolled.map(({ courseId, course, completedLessons, lastLessonId }) => {
                const pct = course.lesson_count ? Math.min(100, Math.round((completedLessons / course.lesson_count) * 100)) : 0
                const isComplete = pct === 100
                const resumeHref = lastLessonId
                  ? `/academy/course/${courseId}/learn?lesson=${lastLessonId}`
                  : `/academy/course/${courseId}/learn`
                return (
                  <div key={courseId} className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-all duration-200">
                    <div className="relative aspect-video bg-muted">
                      {course.thumbnail_url
                        ? <Image src={course.thumbnail_url} alt={course.title} fill className="object-cover" sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw" />
                        : <div className="w-full h-full flex items-center justify-center text-4xl">🎓</div>
                      }
                      {isComplete && (
                        <div className="absolute top-2 right-2">
                          <span className="flex items-center gap-1 bg-green-600/90 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Done
                          </span>
                        </div>
                      )}
                      {course.level && (
                        <div className="absolute bottom-2 left-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${LEVEL_COLORS[course.level] ?? ''}`}>{course.level}</span>
                        </div>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 bg-zinc-800"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="font-bold text-sm leading-snug line-clamp-2">{course.title}</h3>
                        <p className="text-xs text-zinc-400 mt-1">{completedLessons}/{course.lesson_count} lessons · {pct}% complete</p>
                      </div>
                      <Link href={resumeHref} className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                        {isComplete ? <><CheckCircle2 className="h-4 w-4" /> Review</> : pct > 0 ? <><Play className="h-4 w-4" /> Resume</> : <><Play className="h-4 w-4" /> Start</>}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Filters */}
        <div className="space-y-3 mb-8">
          {/* Category pills */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Link
                key={cat.value}
                href={`/classes${buildParams(currentParams, { category: cat.value })}`}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  (category ?? '') === cat.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                )}
              >
                {cat.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            {/* Type filter */}
            <div className="flex flex-wrap gap-2">
              {types.map((t) => (
                <Link
                  key={t.value}
                  href={`/classes${buildParams(currentParams, { type: t.value })}`}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                    (type ?? '') === t.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </div>

            {/* Level filter */}
            <div className="flex flex-wrap gap-2">
              {levels.map((s) => (
                <Link
                  key={s.value}
                  href={`/classes${buildParams(currentParams, { level: s.value })}`}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                    (level ?? '') === s.value
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  )}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Browse All / Discover */}
        {enrolled.length > 0 && browseClasses.length > 0 && (
          <h2 className="text-xl font-bold">Discover More</h2>
        )}
        {/* Classes grid */}
        {browseClasses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {browseClasses.map((cls) => {
              const creator = cls.creator as { username: string; display_name: string | null; avatar_url: string | null } | null
              return (
                <Link
                  key={cls.id}
                  href={`/academy/course/${cls.id}`}
                  className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-200"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-muted">
                    {cls.thumbnail_url ? (
                      <Image
                        src={cls.thumbnail_url}
                        alt={cls.title}
                        fill
                        className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🎓</div>
                    )}
                    {/* Type badge */}
                    {cls.format && cls.format !== 'recorded' && (
                      <div className="absolute top-2 left-2">
                        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          {cls.format === 'live' ? 'Live' : 'Live + Recorded'}
                        </span>
                      </div>
                    )}
                    {/* Price badge */}
                    <div className="absolute top-2 right-2">
                      {cls.pricing_model === 'free' ? (
                        <span className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">FREE</span>
                      ) : (
                        <span className="bg-black/80 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          ${cls.price_usd?.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {/* Level badge */}
                    {cls.level && (
                      <div className="absolute bottom-2 left-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${LEVEL_COLORS[cls.level] ?? ''}`}>
                          {cls.level}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="p-4">
                    <h3 className="font-bold text-sm leading-snug line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                      {cls.title}
                    </h3>
                    {creator && (
                      <p className="text-muted-foreground text-xs mb-2">
                        {creator.display_name ?? creator.username}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {cls.lesson_count} lessons
                      </span>
                      {cls.total_duration_seconds > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(cls.total_duration_seconds)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {cls.enrollment_count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-24">
            <GraduationCap className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {enrolled.length > 0 && !type && !category && !level
                ? "You're enrolled in all available classes!"
                : 'No classes found'}
            </h3>
            <p className="text-muted-foreground">
              {type || category || level
                ? 'Try adjusting your filters to find more classes.'
                : 'Check back soon — new classes are being added all the time.'}
            </p>
          </div>
        )}
      </main>
    </AppShell>
  )
}
