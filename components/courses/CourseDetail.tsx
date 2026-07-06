'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  BookOpen, Clock, Users, ChevronDown, ChevronUp,
  Lock, Play, Radio, FileText, CheckCircle,
  AlertCircle, Edit,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Lesson {
  id: string
  title: string
  description: string | null
  duration_seconds: number | null
  is_preview: boolean
  lesson_type: 'video' | 'live' | 'text' | 'quiz'
  position: number
  live_scheduled_at: string | null
}

interface Section {
  id: string
  title: string
  position: number
  lessons: Lesson[]
}

interface CourseDetailProps {
  course: {
    id: string
    title: string
    description: string | null
    thumbnail_url: string | null
    pricing_model: string
    price_usd: number | null
    lesson_count: number
    enrollment_count: number
    total_duration_seconds: number
    level: string
    category: string | null
    what_you_learn: string[] | null
    requirements: string[] | null
    creator: {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      bio: string | null
    } | null
  }
  sections: Section[]
  isEnrolled: boolean
  isCreator: boolean
  userId: string | null
}

const LESSON_ICON: Record<string, React.ElementType> = {
  video: Play,
  live: Radio,
  text: FileText,
  quiz: CheckCircle,
}

const formatDuration = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

const formatTotal = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function CourseDetail({
  course, sections, isEnrolled, isCreator, userId,
}: CourseDetailProps) {
  const router = useRouter()
  const [openSections, setOpenSections] = useState<Set<string>>(new Set([sections[0]?.id]))
  const [enrolling, setEnrolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const firstLesson = sections.flatMap(s => s.lessons)[0]
  const learnUrl = isEnrolled && firstLesson ? `/learn/${course.id}/${firstLesson.id}` : null

  const handleEnroll = async () => {
    if (!userId) { router.push(`/login?next=/courses/${course.id}`); return }
    setEnrolling(true)
    setError(null)
    try {
      const res = await fetch('/api/courses/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: course.id,
          successUrl: `${window.location.origin}/learn/${course.id}`,
          cancelUrl: window.location.href,
        }),
      })
      const json = await res.json().catch(() => ({})) as { url?: string; enrolled?: boolean; error?: string }
      if (!res.ok) { setError(json.error ?? 'Enrollment failed — please try again'); return }
      if (json.url) {
        window.location.href = json.url // Stripe checkout for paid courses
      } else if (json.enrolled) {
        router.push(`/learn/${course.id}`)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setEnrolling(false)
    }
  }

  const creator = course.creator

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Breadcrumb */}
          <nav className="text-xs text-muted-foreground">
            <Link href="/courses" className="hover:text-foreground">Courses</Link>
            {course.category && <> / <span>{course.category}</span></>}
          </nav>

          {/* Title */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{course.title}</h1>
            {course.description && (
              <p className="text-muted-foreground mt-2 leading-relaxed">{course.description}</p>
            )}
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              {course.lesson_count} lessons
            </span>
            {course.total_duration_seconds > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatTotal(course.total_duration_seconds)} total
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {course.enrollment_count.toLocaleString()} enrolled
            </span>
            {course.level && (
              <span className="capitalize">{course.level}</span>
            )}
          </div>

          {/* What you'll learn */}
          {course.what_you_learn?.length ? (
            <div className="bg-muted/40 rounded-xl p-4">
              <h2 className="font-bold mb-3">What you&apos;ll learn</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {course.what_you_learn.map((item, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Curriculum */}
          <div>
            <h2 className="font-bold text-lg mb-3">Course curriculum</h2>
            {sections.length === 0 ? (
              <p className="text-muted-foreground text-sm">Curriculum coming soon.</p>
            ) : (
              <div className="space-y-2">
                {sections.map((section) => (
                  <div key={section.id} className="border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-left">
                        <span className="font-semibold text-sm">{section.title}</span>
                        <span className="text-muted-foreground text-xs">
                          {section.lessons.length} {section.lessons.length === 1 ? 'lesson' : 'lessons'}
                        </span>
                      </div>
                      {openSections.has(section.id) ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>
                    {openSections.has(section.id) && (
                      <div className="divide-y divide-border border-t border-border">
                        {section.lessons.map((lesson) => {
                          const Icon = LESSON_ICON[lesson.lesson_type] ?? Play
                          const canAccess = isEnrolled || lesson.is_preview
                          return (
                            <div
                              key={lesson.id}
                              className={cn(
                                'flex items-center gap-3 px-4 py-3 text-sm',
                                canAccess ? 'hover:bg-muted/40' : 'opacity-60',
                              )}
                            >
                              <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="truncate">{lesson.title}</p>
                                {lesson.live_scheduled_at && (
                                  <p className="text-xs text-muted-foreground">
                                    Live: {new Date(lesson.live_scheduled_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {lesson.is_preview && (
                                  <span className="text-primary text-[10px] font-bold">PREVIEW</span>
                                )}
                                {!canAccess && <Lock className="h-3 w-3 text-muted-foreground" />}
                                {lesson.duration_seconds && (
                                  <span className="text-muted-foreground text-xs font-mono">
                                    {formatDuration(lesson.duration_seconds)}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instructor */}
          {creator && (
            <div>
              <h2 className="font-bold text-lg mb-3">Instructor</h2>
              <Link href={`/profile/${creator.username}`} className="flex items-start gap-3 group">
                <Avatar className="h-14 w-14 flex-shrink-0">
                  <AvatarImage src={creator.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
                    {(creator.display_name ?? creator.username).charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold group-hover:text-primary transition-colors">
                    {creator.display_name ?? creator.username}
                  </p>
                  {creator.bio && (
                    <p className="text-muted-foreground text-sm mt-1 line-clamp-3">{creator.bio}</p>
                  )}
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* Right — sticky enroll card */}
        <div className="lg:col-span-1">
          <div className="sticky top-20">
            {/* Video/thumbnail preview */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-muted mb-4">
              {course.thumbnail_url ? (
                <Image src={course.thumbnail_url} alt={course.title} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl">🎓</div>
              )}
              {isEnrolled && firstLesson && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Link
                    href={`/learn/${course.id}/${firstLesson.id}`}
                    className="bg-white text-black rounded-full p-4 hover:scale-105 transition-transform"
                  >
                    <Play className="h-6 w-6 fill-black" />
                  </Link>
                </div>
              )}
            </div>

            {/* Price + CTA */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              {/* Price display */}
              <div>
                {course.pricing_model === 'free' ? (
                  <p className="text-3xl font-bold text-green-500">Free</p>
                ) : (
                  <p className="text-3xl font-bold">${course.price_usd?.toFixed(2)}</p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {isCreator ? (
                <Link href={`/creator/courses/${course.id}`} className="block">
                  <Button className="w-full gap-2">
                    <Edit className="h-4 w-4" />
                    Edit Course
                  </Button>
                </Link>
              ) : isEnrolled ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-500 text-sm font-semibold">
                    <CheckCircle className="h-4 w-4" />
                    You&apos;re enrolled
                  </div>
                  {learnUrl && (
                    <Link href={learnUrl} className="block">
                      <Button className="w-full gap-2">
                        <Play className="h-4 w-4" />
                        Continue Learning
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleEnroll}
                  disabled={enrolling}
                >
                  {enrolling ? 'Loading…' : course.pricing_model === 'free' ? 'Enroll for Free' : 'Enroll Now'}
                </Button>
              )}

              <p className="text-xs text-muted-foreground text-center">
                {course.pricing_model === 'free'
                  ? 'Free forever — no credit card needed'
                  : '30-day money-back guarantee'}
              </p>

              {/* Course includes */}
              <div className="space-y-1.5 text-sm">
                <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">This course includes</p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Play className="h-3.5 w-3.5" />
                  {course.lesson_count} on-demand lessons
                </div>
                {course.total_duration_seconds > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {formatTotal(course.total_duration_seconds)} of content
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" />
                  Full lifetime access
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
