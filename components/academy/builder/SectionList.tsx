'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import type { CourseSection, CourseLesson } from '@/lib/academy/types'
import LessonEditor from './LessonEditor'

const inputCls =
  'px-2.5 py-1.5 rounded-md bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500'

export default function SectionList({
  courseId,
  sections,
  setSections,
}: {
  courseId: string
  sections: CourseSection[]
  setSections: (updater: (s: CourseSection[]) => CourseSection[]) => void
}) {
  const [adding, setAdding] = useState(false)

  async function addSection() {
    setAdding(true)
    try {
      const res = await fetch(`/api/academy/courses/${courseId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New section', order_index: sections.length }),
      })
      const created = res.ok ? (await res.json().catch(() => null)) : null
      const section: CourseSection =
        (created?.section ?? created) || {
          id: `tmp-${Date.now()}`,
          course_id: courseId,
          title: 'New section',
          order_index: sections.length,
          lessons: [],
        }
      if (!section.lessons) section.lessons = []
      setSections((s) => [...s, section])
    } finally {
      setAdding(false)
    }
  }

  async function renameSection(id: string, title: string) {
    setSections((s) => s.map((x) => (x.id === id ? { ...x, title } : x)))
    await fetch(`/api/academy/courses/${courseId}/sections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }).catch(() => {})
  }

  async function deleteSection(id: string) {
    setSections((s) => s.filter((x) => x.id !== id))
    await fetch(`/api/academy/courses/${courseId}/sections/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  async function move(id: string, dir: -1 | 1) {
    setSections((s) => {
      const idx = s.findIndex((x) => x.id === id)
      const j = idx + dir
      if (idx < 0 || j < 0 || j >= s.length) return s
      const next = [...s]
      ;[next[idx], next[j]] = [next[j], next[idx]]
      next.forEach((sec, i) => {
        fetch(`/api/academy/courses/${courseId}/sections/${sec.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_index: i }),
        }).catch(() => {})
      })
      return next.map((sec, i) => ({ ...sec, order_index: i }))
    })
  }

  async function addLesson(sectionId: string) {
    const sec = sections.find((s) => s.id === sectionId)
    const order = sec?.lessons.length ?? 0
    const res = await fetch(`/api/academy/courses/${courseId}/sections/${sectionId}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New lesson', order_index: order }),
    })
    const created = res.ok ? await res.json().catch(() => null) : null
    const lesson: CourseLesson =
      (created?.lesson ?? created) || {
        id: `tmp-${Date.now()}`,
        section_id: sectionId,
        title: 'New lesson',
        description: null,
        video_id: null,
        mux_playback_id: null,
        order_index: order,
        is_free_preview: false,
        duration: null,
        resources: [],
        chapters: [],
        recipe: null,
      }
    if (!lesson.resources) lesson.resources = []
    if (!lesson.chapters) lesson.chapters = []
    setSections((s) => s.map((x) => (x.id === sectionId ? { ...x, lessons: [...x.lessons, lesson] } : x)))
  }

  function patchLesson(sectionId: string, lessonId: string, patch: Partial<CourseLesson>) {
    setSections((s) =>
      s.map((x) =>
        x.id === sectionId
          ? { ...x, lessons: x.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)) }
          : x
      )
    )
  }

  async function deleteLesson(sectionId: string, lessonId: string) {
    setSections((s) =>
      s.map((x) => (x.id === sectionId ? { ...x, lessons: x.lessons.filter((l) => l.id !== lessonId) } : x))
    )
    await fetch(`/api/academy/lessons/${lessonId}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div className="space-y-4">
      {sections.map((sec, i) => (
        <div key={sec.id} className="border border-zinc-800 rounded-xl bg-zinc-900/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <input
              defaultValue={sec.title}
              onBlur={(e) => e.target.value !== sec.title && renameSection(sec.id, e.target.value)}
              className={inputCls + ' flex-1 font-medium'}
            />
            <button onClick={() => move(sec.id, -1)} disabled={i === 0} className="text-zinc-500 hover:text-zinc-200 disabled:opacity-30">
              <ChevronUp className="h-4 w-4" />
            </button>
            <button onClick={() => move(sec.id, 1)} disabled={i === sections.length - 1} className="text-zinc-500 hover:text-zinc-200 disabled:opacity-30">
              <ChevronDown className="h-4 w-4" />
            </button>
            <button onClick={() => deleteSection(sec.id)} className="text-zinc-500 hover:text-red-400">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {sec.lessons.map((l) => (
              <LessonEditor
                key={l.id}
                lesson={l}
                onPatch={(id, patch) => patchLesson(sec.id, id, patch)}
                onDelete={(id) => deleteLesson(sec.id, id)}
              />
            ))}
          </div>

          <button onClick={() => addLesson(sec.id)} className="text-xs text-indigo-400 hover:text-indigo-300 mt-3 inline-flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add lesson
          </button>
        </div>
      ))}

      <Button variant="outline" onClick={addSection} disabled={adding} className="gap-2 w-full">
        {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add section
      </Button>
    </div>
  )
}
