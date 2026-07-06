import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import EnrollButton from '@/components/classes/EnrollButton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatViews, formatDuration } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Users,
  Clock,
  GraduationCap,
  Lock,
  Play,
  CheckCircle,
  Award,
  MessageSquare,
  Calendar,
  ChevronRight,
} from 'lucide-react'
import type { Class, ClassLesson } from '@/types'

interface PageProps {
  params: { classId: string }
}

const categoryGradients: Record<string, string> = {
  baking: 'from-orange-400 to-amber-600',
  cooking: 'from-red-400 to-rose-600',
  pastry: 'from-pink-400 to-purple-500',
  grilling: 'from-orange-600 to-red-700',
  international: 'from-blue-400 to-indigo-600',
  vegan: 'from-green-400 to-emerald-600',
  nutrition: 'from-teal-400 to-cyan-600',
  general: 'from-gray-400 to-gray-600',
}

const typeBadgeStyle: Record<string, string> = {
  live: 'bg-red-500 text-white',
  series: 'bg-purple-500 text-white',
  recorded: 'bg-blue-500 text-white',
}

const typeLabel: Record<string, string> = {
  live: 'LIVE',
  series: 'Series',
  recorded: 'Recorded',
}

const skillLabel: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all_levels: 'All Levels',
}

export default async function ClassDetailPage({ params }: PageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: cls } = await supabase
    .from('classes')
    .select(`
      *,
      instructor:profiles(id, username, display_name, avatar_url, bio),
      channel:channels(id, name, slug, thumbnail_url, subscriber_count),
      lessons:class_lessons(*)
    `)
    .eq('id', params.classId)
    .eq('is_published', true)
    .single()

  if (!cls) notFound()

  // Check if user is enrolled
  let isEnrolled = false
  if (user) {
    const { data: enrollment } = await supabase
      .from('class_enrollments')
      .select('id')
      .eq('class_id', cls.id)
      .eq('user_id', user.id)
      .single()
    isEnrolled = !!enrollment
  }

  const gradient = categoryGradients[cls.category] ?? categoryGradients.general
  const instructorName = cls.instructor?.display_name ?? cls.instructor?.username ?? 'Instructor'
  const instructorInitial = instructorName.charAt(0).toUpperCase()

  // Sort lessons by order_index
  const lessons: ClassLesson[] = (cls.lessons ?? []).sort(
    (a: ClassLesson, b: ClassLesson) => a.order_index - b.order_index
  )

  // Total duration
  const totalSeconds = lessons.reduce((acc: number, l: ClassLesson) => acc + (l.duration ?? 0), 0)

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column — 2/3 */}
          <div className="lg:col-span-2 space-y-8">
            {/* Hero thumbnail */}
            <div className="relative aspect-video rounded-xl overflow-hidden">
              {cls.thumbnail_url ? (
                <Image src={cls.thumbnail_url} alt={cls.title} fill className="object-cover" />
              ) : (
                <div className={cn('absolute inset-0 bg-gradient-to-br', gradient)} />
              )}
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute top-4 left-4 flex gap-2">
                <span className={cn('text-sm font-bold px-3 py-1 rounded', typeBadgeStyle[cls.type] ?? 'bg-gray-500 text-white')}>
                  {typeLabel[cls.type] ?? cls.type}
                </span>
                <span className="text-sm font-medium px-3 py-1 rounded bg-black/50 text-white">
                  {skillLabel[cls.skill_level] ?? cls.skill_level}
                </span>
              </div>
            </div>

            {/* Title */}
            <div>
              <h1 className="text-3xl font-bold mb-3">{cls.title}</h1>

              {/* Instructor line */}
              <Link
                href={cls.channel?.slug ? `/channel/${cls.channel.slug}` : '#'}
                className="inline-flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={cls.instructor?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-white text-sm">{instructorInitial}</AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground">
                  Taught by <span className="font-medium text-foreground">{instructorName}</span>
                </span>
              </Link>
            </div>

            {/* Overview */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Overview</h2>
              {cls.description ? (
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{cls.description}</p>
              ) : (
                <p className="text-muted-foreground italic">No description provided.</p>
              )}

              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>{formatViews(cls.enrollment_count)} students enrolled</span>
                </div>
                {totalSeconds > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>{formatDuration(totalSeconds)} total</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 capitalize">
                  <GraduationCap className="h-4 w-4" />
                  <span>{cls.category}</span>
                </div>
                {cls.type === 'live' && cls.scheduled_at && (
                  <div className="flex items-center gap-1.5 text-red-500 font-medium">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(cls.scheduled_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Curriculum */}
            {lessons.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4">
                  Curriculum
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
                  </span>
                </h2>
                <div className="border rounded-xl divide-y overflow-hidden">
                  {lessons.map((lesson, idx) => {
                    const locked = !lesson.is_free_preview && !isEnrolled
                    return (
                      <div
                        key={lesson.id}
                        className={cn(
                          'flex items-center gap-4 px-4 py-3',
                          locked ? 'opacity-60' : 'hover:bg-muted/50'
                        )}
                      >
                        <span className="text-muted-foreground text-sm w-6 shrink-0 text-right">
                          {idx + 1}
                        </span>
                        {locked ? (
                          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <Play className="h-4 w-4 text-primary shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{lesson.title}</p>
                          {lesson.description && (
                            <p className="text-xs text-muted-foreground truncate">{lesson.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {lesson.is_free_preview && (
                            <Badge variant="secondary" className="text-xs">Preview</Badge>
                          )}
                          {lesson.duration ? (
                            <span className="text-xs text-muted-foreground">{formatDuration(lesson.duration)}</span>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Instructor */}
            <section>
              <h2 className="text-xl font-semibold mb-4">About the Instructor</h2>
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={cls.instructor?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-white text-xl">{instructorInitial}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold text-lg">{instructorName}</p>
                  {cls.channel && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {formatViews(cls.channel.subscriber_count ?? 0)} subscribers on{' '}
                      <Link href={`/channel/${cls.channel.slug}`} className="text-primary hover:underline">
                        {cls.channel.name}
                      </Link>
                    </p>
                  )}
                  {cls.instructor?.bio ? (
                    <p className="text-muted-foreground text-sm leading-relaxed">{cls.instructor.bio}</p>
                  ) : (
                    <p className="text-muted-foreground text-sm italic">No bio available.</p>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Right sidebar — 1/3 sticky */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {/* Thumbnail preview (desktop only) */}
              <div className="hidden lg:block relative aspect-video rounded-xl overflow-hidden">
                {cls.thumbnail_url ? (
                  <Image src={cls.thumbnail_url} alt={cls.title} fill className="object-cover" />
                ) : (
                  <div className={cn('absolute inset-0 bg-gradient-to-br', gradient)} />
                )}
              </div>

              {/* CTA card */}
              <div className="border rounded-xl p-5 space-y-4 bg-card shadow-sm">
                {/* Price */}
                <div className="text-center">
                  {cls.price === 0 ? (
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">Free</p>
                  ) : (
                    <p className="text-3xl font-bold">{formatCurrency(cls.price)}</p>
                  )}
                </div>

                {/* Live date */}
                {cls.type === 'live' && cls.scheduled_at && (
                  <div className="flex items-center gap-2 text-sm text-red-500 font-medium justify-center">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(cls.scheduled_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}

                {/* Enroll button */}
                <EnrollButton
                  classId={cls.id}
                  price={cls.price}
                  isEnrolled={isEnrolled}
                  userId={user?.id ?? null}
                />

                {/* Benefits */}
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[
                    'Lifetime access',
                    'Watch at your own pace',
                    'Access on any device',
                  ].map((benefit) => (
                    <li key={benefit} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Quick stats */}
              <div className="border rounded-xl p-4 space-y-2 bg-card text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Students</span>
                  <span className="font-medium">{formatViews(cls.enrollment_count)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Level</span>
                  <span className="font-medium capitalize">{skillLabel[cls.skill_level] ?? cls.skill_level}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{typeLabel[cls.type] ?? cls.type}</span>
                </div>
                {lessons.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lessons</span>
                    <span className="font-medium">{lessons.length}</span>
                  </div>
                )}
                {totalSeconds > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">{formatDuration(totalSeconds)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
