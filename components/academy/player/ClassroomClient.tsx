'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Course, CourseSection, CourseLesson } from '@/lib/academy/types'
import CurriculumSidebar from './CurriculumSidebar'
import LessonPlayer from './LessonPlayer'
import CompletionCard from './CompletionCard'
import RecipePanel from '../RecipePanel'
import ShoppingList from '../ShoppingList'

type Tab = 'recipe' | 'shopping' | 'resources' | 'notes'

export default function ClassroomClient({
  course,
  sections,
  initialCompletedIds,
  initialLessonId,
  certificateCode,
}: {
  course: Course
  sections: CourseSection[]
  initialCompletedIds: string[]
  initialLessonId: string | null
  certificateCode: string | null
}) {
  const allLessons = useMemo(() => sections.flatMap((s) => s.lessons), [sections])
  const firstLesson = allLessons[0] ?? null

  const startLesson =
    allLessons.find((l) => l.id === initialLessonId) ?? firstLesson

  const [activeLesson, setActiveLesson] = useState<CourseLesson | null>(startLesson)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set(initialCompletedIds))
  const [tab, setTab] = useState<Tab>('recipe')
  const [notes, setNotes] = useState('')

  const requiredIds = allLessons.filter((l) => !l.is_free_preview).map((l) => l.id)
  const allComplete =
    requiredIds.length > 0 && requiredIds.every((id) => completedIds.has(id))

  function markComplete(lessonId: string) {
    setCompletedIds((prev) => {
      if (prev.has(lessonId)) return prev
      const next = new Set(prev)
      next.add(lessonId)
      return next
    })
    // Auto-advance to the next lesson.
    const idx = allLessons.findIndex((l) => l.id === lessonId)
    const next = allLessons[idx + 1]
    if (next) setActiveLesson(next)
  }

  const resources = activeLesson?.resources ?? []

  return (
    <div className="flex min-h-[calc(100svh-56px)] flex-col lg:flex-row">
      {/* Curriculum sidebar */}
      <aside className="w-full flex-none border-b border-zinc-800 bg-zinc-950 lg:h-[calc(100svh-56px)] lg:w-80 lg:border-b-0 lg:border-r">
        <CurriculumSidebar
          courseTitle={course.title}
          sections={sections}
          activeLessonId={activeLesson?.id ?? null}
          completedIds={completedIds}
          onSelect={setActiveLesson}
        />
      </aside>

      {/* Player + panels */}
      <main className="flex-1 overflow-y-auto bg-zinc-950 p-4 lg:p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {activeLesson ? (
            <>
              <div>
                <LessonPlayer
                  key={activeLesson.id}
                  lesson={activeLesson}
                  onCompleted={() => markComplete(activeLesson.id)}
                />
                <div className="mt-3">
                  <h1 className="text-lg font-semibold text-zinc-100">{activeLesson.title}</h1>
                  {activeLesson.description && (
                    <p className="mt-1 text-sm text-zinc-400">{activeLesson.description}</p>
                  )}
                </div>
              </div>

              {allComplete && (
                <CompletionCard
                  courseId={course.id}
                  issuesCertificate={course.issues_certificate}
                  existingCode={certificateCode}
                />
              )}

              {/* Tabs */}
              <div>
                <div className="flex gap-1 border-b border-zinc-800">
                  {(
                    [
                      ['recipe', 'Recipe'],
                      ['shopping', 'Shopping list'],
                      ['resources', 'Resources'],
                      ['notes', 'Notes'],
                    ] as [Tab, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={`px-3 py-2 text-sm transition-colors ${
                        tab === key
                          ? 'border-b-2 border-emerald-500 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="pt-4">
                  {tab === 'recipe' && <RecipePanel recipe={activeLesson.recipe} />}
                  {tab === 'shopping' && <ShoppingList courseId={course.id} />}
                  {tab === 'resources' && (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                      {resources.length === 0 ? (
                        <p className="text-center text-sm text-zinc-500">No resources for this lesson.</p>
                      ) : (
                        <ul className="space-y-2">
                          {resources.map((r, i) => (
                            <li key={i}>
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-emerald-400 hover:underline"
                              >
                                <span aria-hidden="true">↓</span>
                                {r.name}
                                {r.type && <span className="text-xs text-zinc-500">({r.type})</span>}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {tab === 'notes' && (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Jot down notes for this lesson…"
                        className="h-40 w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-600 focus:outline-none"
                      />
                      <p className="mt-2 text-xs text-zinc-600">
                        Notes are kept on this device for the current session.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
              This course has no lessons yet.{' '}
              <Link href={`/academy/course/${course.id}`} className="text-emerald-400 hover:underline">
                Back to course
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
