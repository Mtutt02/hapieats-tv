'use client'

import { useEffect, useRef, useState } from 'react'
import type { CourseLesson } from '@/lib/academy/types'

/**
 * LessonPlayer — lazy-loaded MuxPlayer wrapper for a single lesson.
 * Only the active lesson is ever mounted (the parent keys/swaps this
 * component per lesson). Reports watch progress to
 * POST /api/academy/lessons/[id]/progress every ~15s and on `ended`.
 * This is intentional playback, so it is NOT muted/autoplay-forced.
 */
export default function LessonPlayer({
  lesson,
  startTime,
  onCompleted,
  onProgress,
  disableProgress = false,
}: {
  lesson: CourseLesson
  startTime?: number
  onCompleted?: () => void
  onProgress?: (seconds: number) => void
  /** Skip server progress reporting (e.g. an un-enrolled free preview). */
  disableProgress?: boolean
}) {
  const [MuxPlayer, setMuxPlayer] = useState<React.ComponentType<Record<string, unknown>> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastReported = useRef(0)
  const reportedComplete = useRef(false)

  // The <mux-player> custom element exposes `currentTime` and `addChapters`.
  function getPlayerEl(): (HTMLElement & { currentTime?: number; addChapters?: (c: unknown[]) => void }) | null {
    return (containerRef.current?.querySelector('mux-player') as
      | (HTMLElement & { currentTime?: number; addChapters?: (c: unknown[]) => void })
      | null) ?? null
  }

  useEffect(() => {
    let alive = true
    import('@mux/mux-player-react').then((m) => {
      if (alive) setMuxPlayer(() => m.default)
    })
    return () => {
      alive = false
    }
  }, [])

  // Add chapter markers to the player once it (and its media) is ready.
  useEffect(() => {
    const el = getPlayerEl()
    const chapters = lesson.chapters ?? []
    if (!el || typeof el.addChapters !== 'function' || chapters.length === 0) return
    const apply = () => {
      try {
        el.addChapters!(
          chapters
            .slice()
            .sort((a, b) => a.t - b.t)
            .map((c) => ({ startTime: c.t, value: c.label })),
        )
      } catch {
        /* older player build without chapter support */
      }
    }
    el.addEventListener('loadedmetadata', apply)
    apply()
    return () => el.removeEventListener('loadedmetadata', apply)
  }, [lesson.id, lesson.chapters, MuxPlayer])

  // Reset per-lesson reporting state whenever the lesson changes.
  useEffect(() => {
    lastReported.current = 0
    reportedComplete.current = false
  }, [lesson.id])

  async function report(seconds: number, completed: boolean) {
    onProgress?.(seconds)
    if (disableProgress) return
    try {
      await fetch(`/api/academy/lessons/${lesson.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds: Math.round(seconds), completed }),
        keepalive: true,
      })
    } catch {
      /* best-effort — swallow network errors */
    }
  }

  // Poll the shadow-DOM <video>'s currentTime every 15s and report.
  useEffect(() => {
    const id = setInterval(() => {
      const t = Number(getPlayerEl()?.currentTime ?? 0)
      if (t > 0 && t - lastReported.current >= 5) {
        lastReported.current = t
        void report(t, false)
      }
    }, 15000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id])

  function handleEnded() {
    if (reportedComplete.current) return
    reportedComplete.current = true
    const t = Number(getPlayerEl()?.currentTime ?? lesson.duration ?? 0)
    void report(t || (lesson.duration ?? 0), true)
    onCompleted?.()
  }

  if (!lesson.mux_playback_id) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-zinc-900 text-sm text-zinc-500">
        Video coming soon for this lesson.
      </div>
    )
  }

  if (!MuxPlayer) {
    return <div className="aspect-video w-full animate-pulse rounded-lg bg-zinc-900" />
  }

  return (
    <div ref={containerRef} className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <MuxPlayer
        playbackId={lesson.mux_playback_id}
        metadata={{ video_title: lesson.title }}
        streamType="on-demand"
        startTime={startTime && startTime > 0 ? startTime : undefined}
        onEnded={handleEnded}
        onPause={() => {
          const t = Number(getPlayerEl()?.currentTime ?? 0)
          if (t > 0) void report(t, false)
        }}
        style={{
          '--media-object-fit': 'contain',
          width: '100%',
          height: '100%',
        } as React.CSSProperties}
      />
    </div>
  )
}
