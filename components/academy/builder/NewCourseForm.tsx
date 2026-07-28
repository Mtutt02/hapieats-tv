'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import {
  COURSE_CATEGORIES,
  type CourseFormat,
  type CourseLevel,
} from '@/lib/academy/types'
import MonetizationPanel, { type MonetizationValue } from './MonetizationPanel'

const FORMATS: CourseFormat[] = ['recorded', 'live', 'hybrid']
const LEVELS: CourseLevel[] = ['beginner', 'intermediate', 'advanced', 'professional']

export default function NewCourseForm() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>('general')
  const [format, setFormat] = useState<CourseFormat>('recorded')
  const [level, setLevel] = useState<CourseLevel>('beginner')
  const [money, setMoney] = useState<MonetizationValue>({
    pricing_model: 'free',
    price: 0,
    pro_included: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canContinue = title.trim().length > 0

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/academy/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          category,
          format,
          level,
          pricing_model: money.pricing_model,
          price: money.pricing_model === 'paid' ? money.price : 0,
          pro_included: money.pro_included,
        }),
      })
      if (!res.ok) throw new Error('Could not create the course. Please try again.')
      const created = await res.json()
      const id = created.id ?? created.course?.id
      router.push(id ? `/academy/${id}` : '/academy')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setSaving(false)
    }
  }

  const inputCls =
    'w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500'

  return (
    <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-900/60 space-y-6">
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-zinc-200 mb-1 block">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sourdough from Scratch"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-200 mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What will students learn?"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-zinc-200 mb-1 block">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                {COURSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-200 mb-1 block">Level</label>
              <select value={level} onChange={(e) => setLevel(e.target.value as CourseLevel)} className={inputCls}>
                {LEVELS.map((l) => (
                  <option key={l} value={l} className="capitalize">
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-200 mb-2 block">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setFormat(f)}
                  className={
                    'rounded-lg border p-3 text-sm font-medium capitalize transition-colors ' +
                    (format === f
                      ? 'border-indigo-500 bg-indigo-500/10 text-zinc-100'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700')
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button disabled={!canContinue} onClick={() => setStep(2)}>
              Next: Monetization
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <MonetizationPanel value={money} onChange={setMoney} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>
              Back
            </Button>
            <Button onClick={submit} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create course
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
