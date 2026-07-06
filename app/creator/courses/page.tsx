import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { BookOpen, Users, Plus, Edit, Eye, EyeOff } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  published: 'bg-green-500/20 text-green-400 border border-green-500/30',
  draft: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
  archived: 'bg-red-500/20 text-red-400 border border-red-500/30',
}

export default async function CreatorCoursesPage() {
  const authClient = createClient()
  const supabase = createServiceClient()

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login?next=/creator/courses')

  const { data: courses } = await supabase
    .from('courses')
    .select('id, title, status, thumbnail_url, lesson_count, enrollment_count, pricing_model, price_usd, created_at')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              My Courses
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Create and manage your courses</p>
          </div>
          <Link
            href="/creator/courses/create"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Course
          </Link>
        </div>

        {(!courses || courses.length === 0) ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl">
            <div className="text-5xl mb-4">🎓</div>
            <p className="font-semibold mb-1">No courses yet</p>
            <p className="text-muted-foreground text-sm mb-6">Share your knowledge with the HapiEats community</p>
            <Link
              href="/creator/courses/create"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Your First Course
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => (
              <div
                key={course.id}
                className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover:border-primary/40 transition-colors"
              >
                {/* Thumbnail */}
                <div className="relative w-20 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                  {course.thumbnail_url ? (
                    <Image src={course.thumbnail_url} alt={course.title} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🎓</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm truncate">{course.title}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[course.status] ?? ''}`}>
                      {course.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      {course.lesson_count} lessons
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {course.enrollment_count} enrolled
                    </span>
                    <span>
                      {course.pricing_model === 'free' ? 'Free' : `$${course.price_usd?.toFixed(2)}`}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {course.status === 'published' && (
                    <Link
                      href={`/courses/${course.id}`}
                      className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                      title="View public page"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  )}
                  <Link
                    href={`/creator/courses/${course.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-xl text-xs font-semibold hover:bg-muted transition-colors"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
