'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, ShoppingCart, Check } from 'lucide-react'
import {
  buildShoppingList,
  COURSE_CATEGORIES,
  type Course,
  type CourseSection,
  type Recipe,
} from '@/lib/academy/types'
import SectionList from './SectionList'
import MonetizationPanel, { type MonetizationValue } from './MonetizationPanel'
import RecipeEditor from './RecipeEditor'

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500'

export default function CourseBuilder({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<Course | null>(null)
  const [sections, setSectionsState] = useState<CourseSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingMeta, setSavingMeta] = useState(false)
  const [metaSaved, setMetaSaved] = useState(false)
  const [showMaster, setShowMaster] = useState(false)
  const [shopping, setShopping] = useState<ReturnType<typeof buildShoppingList> | null>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/academy/courses/${courseId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Course not found'))))
      .then((data) => {
        if (!active) return
        const c: Course = data.course ?? data
        setCourse(c)
        const secs: CourseSection[] = (data.sections ?? c.sections ?? []).map((s: CourseSection) => ({
          ...s,
          lessons: s.lessons ?? [],
        }))
        setSectionsState(secs)
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [courseId])

  const setSections = (updater: (s: CourseSection[]) => CourseSection[]) => setSectionsState(updater)

  async function patchCourse(patch: Partial<Course>) {
    setCourse((c) => (c ? { ...c, ...patch } : c))
    setSavingMeta(true)
    setMetaSaved(false)
    try {
      const res = await fetch(`/api/academy/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) setMetaSaved(true)
    } finally {
      setSavingMeta(false)
    }
  }

  const localRecipes = useMemo<Recipe[]>(
    () => sections.flatMap((s) => s.lessons.map((l) => l.recipe).filter(Boolean) as Recipe[]),
    [sections]
  )

  function previewShoppingList() {
    setShopping(buildShoppingList(localRecipes))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }
  if (error || !course) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center text-zinc-400">
        <p>{error ?? 'Course not found'}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/academy">Back to Academy</Link>
        </Button>
      </main>
    )
  }

  const money: MonetizationValue = {
    pricing_model: course.pricing_model,
    price: course.price,
    pro_included: course.pro_included,
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/academy" className="text-sm text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Academy
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 h-4 flex items-center gap-1">
            {savingMeta ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Saving
              </>
            ) : metaSaved ? (
              <>
                <Check className="h-3 w-3 text-green-400" /> Saved
              </>
            ) : null}
          </span>
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={course.is_published}
              onChange={(e) => patchCourse({ is_published: e.target.checked })}
              className="h-4 w-4 accent-indigo-500"
            />
            {course.is_published ? 'Published' : 'Publish'}
          </label>
        </div>
      </div>

      <section className="border border-zinc-800 rounded-xl bg-zinc-900/60 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200">Course details</h2>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Title</label>
          <input
            defaultValue={course.title}
            onBlur={(e) => e.target.value !== course.title && patchCourse({ title: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Description</label>
          <textarea
            defaultValue={course.description ?? ''}
            rows={3}
            onBlur={(e) => e.target.value !== (course.description ?? '') && patchCourse({ description: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Category</label>
          <select
            value={course.category}
            onChange={(e) => patchCourse({ category: e.target.value })}
            className={inputCls}
          >
            {COURSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="border border-zinc-800 rounded-xl bg-zinc-900/60 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200">Monetization</h2>
        <MonetizationPanel value={money} onChange={(v) => patchCourse(v)} />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200">Curriculum</h2>
        <SectionList courseId={courseId} sections={sections} setSections={setSections} />
      </section>

      <section className="border border-zinc-800 rounded-xl bg-zinc-900/60 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Master recipe</h2>
          {!showMaster && (
            <Button size="sm" variant="outline" onClick={() => setShowMaster(true)}>
              Add master recipe
            </Button>
          )}
        </div>
        <p className="text-xs text-zinc-500">A course-level signature recipe not tied to any single lesson.</p>
        {showMaster && <RecipeEditor lessonId={`course:${courseId}`} />}
      </section>

      <section className="border border-zinc-800 rounded-xl bg-zinc-900/60 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Shopping list preview
          </h2>
          <Button size="sm" variant="outline" onClick={previewShoppingList}>
            Build from recipes
          </Button>
        </div>
        {shopping && (
          shopping.length === 0 ? (
            <p className="text-xs text-zinc-500">No ingredients found. Save a recipe first, then rebuild.</p>
          ) : (
            <ul className="text-sm text-zinc-300 space-y-1">
              {shopping.map((it) => (
                <li key={it.key} className="flex justify-between border-b border-zinc-800/60 py-1">
                  <span>{it.item}</span>
                  <span className="text-zinc-500">{it.qty}</span>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </main>
  )
}
