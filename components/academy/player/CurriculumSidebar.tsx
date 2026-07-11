'use client'

import type { CourseSection, CourseLesson } from '@/lib/academy/types'

function fmtDuration(sec: number | null): string {
  if (!sec || sec <= 0) return ''
  const m = Math.round(sec / 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}

export default function CurriculumSidebar({
  courseTitle,
  sections,
  activeLessonId,
  completedIds,
  onSelect,
}: {
  courseTitle: string
  sections: CourseSection[]
  activeLessonId: string | null
  completedIds: Set<string>
  onSelect: (lesson: CourseLesson) => void
}) {
  const allLessons = sections.flatMap((s) => s.lessons)
  const total = allLessons.length
  const done = allLessons.filter((l) => completedIds.has(l.id)).length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 p-4">
        <p className="truncate text-sm font-semibold text-zinc-100">{courseTitle}</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-zinc-400">
            {done}/{total}
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {sections.map((section) => (
          <div key={section.id} className="mb-2">
            <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {section.title}
            </p>
            <ul>
              {section.lessons.map((lesson) => {
                const isActive = lesson.id === activeLessonId
                const isDone = completedIds.has(lesson.id)
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(lesson)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                        isActive ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-900'
                      }`}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <span
                        className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border text-[10px] ${
                          isDone
                            ? 'border-emerald-500 bg-emerald-500 text-black'
                            : 'border-zinc-600 text-transparent'
                        }`}
                        aria-hidden="true"
                      >
                        {isDone ? '✓' : ''}
                      </span>
                      <span className="flex-1 truncate">
                        {lesson.title}
                        {lesson.is_free_preview && (
                          <span className="ml-2 rounded bg-zinc-700 px-1 py-0.5 text-[9px] uppercase text-zinc-300">
                            preview
                          </span>
                        )}
                      </span>
                      {fmtDuration(lesson.duration) && (
                        <span className="flex-none text-xs text-zinc-500">{fmtDuration(lesson.duration)}</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  )
}
