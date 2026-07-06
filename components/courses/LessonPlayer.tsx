'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, CheckCircle, Circle,
  Play, Radio, FileText, Menu, X, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Lazy-load MuxPlayer (no SSR)
let MuxPlayer: React.ComponentType<Record<string, unknown>> | null = null

interface Lesson {
  id: string
  title: string
  description?: string | null
  muxPlaybackId?: string | null
  lessonType: 'video' | 'live' | 'text' | 'quiz'
  liveScheduledAt?: string | null
}

interface SidebarLesson {
  id: string
  title: string
  duration_seconds?: number | null
  is_preview: boolean
  lesson_type: string
  position: number
}

interface SidebarSection {
  id: string
  title: string
  position: number
  lessons: SidebarLesson[]
}

interface LessonPlayerProps {
  lesson: Lesson
  course: { id: string; title: string }
  sections: SidebarSection[]
  currentLessonId: string
  initialProgress: number
}

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

const LESSON_ICON: Record<string, React.ElementType> = {
  video: Play,
  live: Radio,
  text: FileText,
  quiz: CheckCircle,
}

export default function LessonPlayer({
  lesson,
  course,
  sections,
  currentLessonId,
  initialProgress,
}: LessonPlayerProps) {
  const router = useRouter()
  const [muxLoaded, setMuxLoaded] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set())
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load MuxPlayer once on mount
  useEffect(() => {
    import('@mux/mux-player-react').then((mod) => {
      MuxPlayer = mod.default as React.ComponentType<Record<string, unknown>>
      setMuxLoaded(true)
    }).catch(console.error)
  }, [])

  // Fetch completed lessons for sidebar state
  useEffect(() => {
    fetch(`/api/courses/${course.id}/progress`)
      .then(r => r.json().catch(() => ({})))
      .then((data: { completedLessonIds?: string[] }) => {
        if (data.completedLessonIds) {
          setCompletedLessons(new Set(data.completedLessonIds))
        }
      })
      .catch(() => {/* ignore */})
  }, [course.id])

  // Debounced progress save
  const saveProgress = useCallback((seconds: number, completed = false) => {
    if (progressTimer.current) clearTimeout(progressTimer.current)
    progressTimer.current = setTimeout(() => {
      fetch(`/api/courses/${course.id}/lessons/${lesson.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progressSeconds: Math.floor(seconds), completed }),
      }).catch(() => {/* ignore */})
      if (completed) {
        setCompletedLessons(prev => new Set([...prev, lesson.id]))
      }
    }, 2000)
  }, [course.id, lesson.id])

  // Flat lesson list for prev/next
  const allLessons = sections.flatMap(s => s.lessons)
  const currentIdx = allLessons.findIndex(l => l.id === currentLessonId)
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null

  const isCompleted = completedLessons.has(currentLessonId)

  const markComplete = async () => {
    saveProgress(0, true)
    if (nextLesson) {
      router.push(`/learn/${course.id}/${nextLesson.id}`)
    }
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background sticky top-0 z-10">
          <Link
            href={`/courses/${course.id}`}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{course.title}</span>
          </Link>
          <span className="text-muted-foreground text-sm">/</span>
          <h1 className="text-sm font-semibold truncate flex-1">{lesson.title}</h1>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-muted rounded-lg"
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Video / content area */}
        <div className="flex-1">
          {lesson.lessonType === 'video' && lesson.muxPlaybackId ? (
            <div className="w-full aspect-video bg-black">
              {muxLoaded && MuxPlayer ? (
                <MuxPlayer
                  playbackId={lesson.muxPlaybackId}
                  streamType="on-demand"
                  autoPlay={false}
                  startTime={initialProgress > 0 ? initialProgress : undefined}
                  onTimeUpdate={(e: React.SyntheticEvent<HTMLVideoElement>) => {
                    const vid = e.currentTarget
                    saveProgress(vid.currentTime)
                  }}
                  onEnded={() => saveProgress(0, true)}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                </div>
              )}
            </div>
          ) : lesson.lessonType === 'live' ? (
            <div className="w-full aspect-video bg-black flex flex-col items-center justify-center gap-4">
              <Radio className="h-12 w-12 text-red-400 animate-pulse" />
              <div className="text-center">
                <p className="text-white font-bold text-lg">Live Session</p>
                {lesson.liveScheduledAt ? (
                  <p className="text-zinc-400 text-sm mt-1">
                    Scheduled: {new Date(lesson.liveScheduledAt).toLocaleDateString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                ) : (
                  <p className="text-zinc-400 text-sm mt-1">Scheduling TBA</p>
                )}
              </div>
            </div>
          ) : (
            // Text / quiz lesson
            <div className="max-w-2xl mx-auto px-4 py-8">
              <h2 className="text-2xl font-bold mb-4">{lesson.title}</h2>
              {lesson.description && (
                <div className="prose prose-invert max-w-none text-foreground leading-relaxed">
                  <p>{lesson.description}</p>
                </div>
              )}
            </div>
          )}

          {/* Lesson footer — description + nav */}
          <div className="px-4 py-6 space-y-6 max-w-3xl">
            {lesson.lessonType === 'video' && lesson.description && (
              <div>
                <h2 className="font-bold text-lg mb-2">{lesson.title}</h2>
                <p className="text-muted-foreground leading-relaxed text-sm">{lesson.description}</p>
              </div>
            )}

            {/* Prev / Next + Complete */}
            <div className="flex items-center gap-3 flex-wrap">
              {prevLesson && (
                <Link
                  href={`/learn/${course.id}/${prevLesson.id}`}
                  className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              )}
              <button
                onClick={markComplete}
                className={cn(
                  'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-colors',
                  isCompleted
                    ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {isCompleted ? (
                  <><CheckCircle className="h-4 w-4" /> Completed</>
                ) : (
                  <>{nextLesson ? 'Complete & Next' : 'Complete Lesson'}</>
                )}
              </button>
              {nextLesson && (
                <Link
                  href={`/learn/${course.id}/${nextLesson.id}`}
                  className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar — curriculum */}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 w-80 bg-background border-l border-border z-40 overflow-y-auto transition-transform duration-200 lg:relative lg:translate-x-0 lg:flex lg:flex-col',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0',
        )}
      >
        <div className="p-4 border-b border-border sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Course Content</h3>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {completedLessons.size} / {allLessons.length} completed
          </p>
          {/* Progress bar */}
          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${allLessons.length > 0 ? (completedLessons.size / allLessons.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sections.map((section) => (
            <div key={section.id}>
              <div className="px-4 py-2.5 bg-muted/40 sticky top-[72px] z-[5]">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground truncate">
                  {section.title}
                </p>
              </div>
              {section.lessons.map((l) => {
                const Icon = LESSON_ICON[l.lesson_type] ?? Play
                const isDone = completedLessons.has(l.id)
                const isCurrent = l.id === currentLessonId
                return (
                  <Link
                    key={l.id}
                    href={`/learn/${course.id}/${l.id}`}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 text-sm border-b border-border/50 hover:bg-muted/50 transition-colors',
                      isCurrent && 'bg-primary/10 border-l-2 border-l-primary',
                    )}
                  >
                    {/* Completion icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {isDone ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Circle className={cn('h-4 w-4', isCurrent ? 'text-primary' : 'text-muted-foreground')} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('truncate leading-snug', isCurrent && 'font-semibold text-primary')}>
                        {l.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                        {l.duration_seconds && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatDuration(l.duration_seconds)}
                          </span>
                        )}
                        {l.is_preview && (
                          <span className="text-[9px] font-bold text-primary">PREVIEW</span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
