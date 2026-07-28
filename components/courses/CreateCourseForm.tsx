'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const CATEGORIES = [
  'Baking & Pastry', 'Grilling & BBQ', 'International Cuisine', 'Plant-Based',
  'Knife Skills', 'Meal Prep', 'Sauces & Stocks', 'Desserts & Sweets',
  'Street Food', 'Fermentation', 'Cocktails & Beverages', 'Nutrition & Health',
]

interface CreateCourseFormProps {
  userId: string
}

export default function CreateCourseForm({ userId }: CreateCourseFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    level: 'beginner',
    pricingModel: 'free',
    priceUsd: '',
    whatYouLearn: ['', '', '', ''],
  })

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  const setLearnItem = (i: number, value: string) => {
    setForm(prev => {
      const arr = [...prev.whatYouLearn]
      arr[i] = value
      return { ...prev, whatYouLearn: arr }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Course title is required'); return }
    if (form.pricingModel === 'paid') {
      const price = parseFloat(form.priceUsd)
      if (isNaN(price) || price < 1) { setError('Price must be at least $1.00'); return }
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/courses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          category: form.category || null,
          level: form.level,
          pricingModel: form.pricingModel,
          priceUsd: form.pricingModel === 'paid' ? parseFloat(form.priceUsd) : 0,
          whatYouLearn: form.whatYouLearn.filter(Boolean),
        }),
      })
      const json = await res.json().catch(() => ({})) as { courseId?: string; error?: string }
      if (!res.ok) { setError(json.error ?? 'Failed to create course'); return }
      router.push(`/creator/courses/${json.courseId}`)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold">Course Title <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. Mastering Sourdough Bread"
          maxLength={120}
          className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold">Description</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="What will students learn in this course?"
          rows={4}
          maxLength={2000}
          className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      {/* Category + Level */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Category</label>
          <select
            value={form.category}
            onChange={e => set('category', e.target.value)}
            className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select category</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Level</label>
          <select
            value={form.level}
            onChange={e => set('level', e.target.value)}
            className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="all_levels">All Levels</option>
          </select>
        </div>
      </div>

      {/* Pricing */}
      <div className="space-y-3">
        <label className="text-sm font-semibold">Pricing</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => set('pricingModel', 'free')}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
              form.pricingModel === 'free'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-muted'
            }`}
          >
            Free
          </button>
          <button
            type="button"
            onClick={() => set('pricingModel', 'paid')}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
              form.pricingModel === 'paid'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-muted'
            }`}
          >
            Paid
          </button>
        </div>
        {form.pricingModel === 'paid' && (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <input
              type="number"
              value={form.priceUsd}
              onChange={e => set('priceUsd', e.target.value)}
              placeholder="29.99"
              min="1"
              step="0.01"
              className="w-full pl-7 pr-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}
      </div>

      {/* What you'll learn */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">What students will learn</label>
        <p className="text-xs text-muted-foreground">Add up to 4 key takeaways</p>
        {form.whatYouLearn.map((item, i) => (
          <input
            key={i}
            type="text"
            value={item}
            onChange={e => setLearnItem(i, e.target.value)}
            placeholder={`Learning outcome ${i + 1}`}
            maxLength={120}
            className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        ))}
      </div>

      {/* Submit */}
      <div className="flex gap-3">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? 'Creating…' : 'Create Course'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/creator/courses')}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Your course will be saved as a draft. You can add lessons and publish when ready.
      </p>
    </form>
  )
}
