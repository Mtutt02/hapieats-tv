import { createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, Users, Clock, Star } from 'lucide-react'

export const dynamic = 'force-dynamic'

const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-green-500/20 text-green-400',
  intermediate: 'bg-yellow-500/20 text-yellow-400',
  advanced: 'bg-red-500/20 text-red-400',
}

export default async function CoursesPage() {
  const supabase = createServiceClient()

  const { data: courses } = await supabase
    .from('courses')
    .select(`
      id, title, description, thumbnail_url, pricing_model, price_usd,
      lesson_count, enrollment_count, total_duration_seconds, level, category,
      creator:profiles!creator_id(id, username, display_name, avatar_url)
    `)
    .eq('status', 'published')
    .order('enrollment_count', { ascending: false })
    .limit(48)

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              Courses
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Learn from expert food creators — from beginner to pro
            </p>
          </div>
          <Link
            href="/creator/courses/create"
            className="hidden sm:flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            + Teach a Course
          </Link>
        </div>

        {/* Course grid */}
        {(!courses || courses.length === 0) ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎓</div>
            <p className="text-muted-foreground">No courses yet — be the first to teach!</p>
            <Link
              href="/creator/courses/create"
              className="inline-flex mt-4 items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Create a Course
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((course) => {
              const creator = course.creator as { username: string; display_name: string | null; avatar_url: string | null } | null
              return (
                <Link
                  key={course.id}
                  href={`/courses/${course.id}`}
                  className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-200"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-muted">
                    {course.thumbnail_url ? (
                      <Image
                        src={course.thumbnail_url}
                        alt={course.title}
                        fill
                        className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🎓</div>
                    )}
                    {/* Price badge */}
                    <div className="absolute top-2 right-2">
                      {course.pricing_model === 'free' ? (
                        <span className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">FREE</span>
                      ) : (
                        <span className="bg-black/80 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          ${course.price_usd?.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {/* Level badge */}
                    {course.level && (
                      <div className="absolute bottom-2 left-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${LEVEL_COLORS[course.level] ?? ''}`}>
                          {course.level}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="p-4">
                    <h3 className="font-bold text-sm leading-snug line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    {creator && (
                      <p className="text-muted-foreground text-xs mb-2">
                        {creator.display_name ?? creator.username}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {course.lesson_count} lessons
                      </span>
                      {course.total_duration_seconds > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(course.total_duration_seconds)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {course.enrollment_count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
