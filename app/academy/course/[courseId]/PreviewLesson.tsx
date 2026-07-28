'use client'

import { useState } from 'react'
import type { CourseLesson } from '@/lib/academy/types'
import LessonPlayer from '@/components/academy/player/LessonPlayer'

/**
 * PreviewLesson — plays a free-preview lesson inline on the landing page,
 * without requiring enrollment. Progress reporting is disabled here (the
 * viewer isn't entitled), so we only mount the player when opened.
 */
export default function PreviewLesson({ lesson, children }: { lesson: CourseLesson; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} className="block w-full text-left hover:bg-zinc-900/60">
        {children}
      </button>
      {open && lesson.mux_playback_id && (
        <div className="border-t border-zinc-800 bg-black p-3">
          <LessonPlayer lesson={{ ...lesson, chapters: [] }} disableProgress />
        </div>
      )}
    </>
  )
}
