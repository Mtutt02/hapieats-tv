'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Loader2, Check } from 'lucide-react'
import type { Recipe, Ingredient } from '@/lib/academy/types'

type Draft = {
  title: string
  servings: string
  prep_minutes: string
  cook_minutes: string
  ingredients: Ingredient[]
  steps: string[]
  notes: string
}

function toDraft(r?: Recipe | null): Draft {
  return {
    title: r?.title ?? '',
    servings: r?.servings != null ? String(r.servings) : '',
    prep_minutes: r?.prep_minutes != null ? String(r.prep_minutes) : '',
    cook_minutes: r?.cook_minutes != null ? String(r.cook_minutes) : '',
    ingredients: r?.ingredients?.length ? r.ingredients : [{ item: '', qty: '', unit: '' }],
    steps: r?.steps?.length ? r.steps : [''],
    notes: r?.notes ?? '',
  }
}

const inputCls =
  'w-full px-2.5 py-1.5 rounded-md bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500'

export default function RecipeEditor({
  lessonId,
  recipe,
  onSaved,
}: {
  lessonId: string
  recipe?: Recipe | null
  onSaved?: (r: Recipe) => void
}) {
  const [d, setD] = useState<Draft>(() => toDraft(recipe))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const num = (v: string) => (v.trim() === '' ? null : Number(v))

  async function save() {
    setSaving(true)
    setError(null)
    setSavedAt(false)
    try {
      const body = {
        title: d.title.trim(),
        servings: num(d.servings),
        prep_minutes: num(d.prep_minutes),
        cook_minutes: num(d.cook_minutes),
        ingredients: d.ingredients.filter((i) => i.item.trim()),
        steps: d.steps.map((s) => s.trim()).filter(Boolean),
        notes: d.notes.trim() || null,
      }
      const res = await fetch(`/api/academy/lessons/${lessonId}/recipe`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Could not save recipe')
      const saved = await res.json().catch(() => null)
      setSavedAt(true)
      if (saved && onSaved) onSaved(saved.recipe ?? saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const setIng = (i: number, patch: Partial<Ingredient>) =>
    setD((p) => ({ ...p, ingredients: p.ingredients.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) }))

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-4">
          <label className="text-xs text-zinc-500 mb-1 block">Recipe title</label>
          <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Servings</label>
          <input value={d.servings} onChange={(e) => setD({ ...d, servings: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Prep (min)</label>
          <input value={d.prep_minutes} onChange={(e) => setD({ ...d, prep_minutes: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Cook (min)</label>
          <input value={d.cook_minutes} onChange={(e) => setD({ ...d, cook_minutes: e.target.value })} className={inputCls} />
        </div>
      </div>

      <div>
        <p className="text-xs text-zinc-500 mb-1.5">Ingredients</p>
        <div className="space-y-1.5">
          {d.ingredients.map((ing, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                placeholder="item"
                value={ing.item}
                onChange={(e) => setIng(i, { item: e.target.value })}
                className={inputCls + ' flex-1'}
              />
              <input
                placeholder="qty"
                value={ing.qty ?? ''}
                onChange={(e) => setIng(i, { qty: e.target.value })}
                className={inputCls + ' w-16'}
              />
              <input
                placeholder="unit"
                value={ing.unit ?? ''}
                onChange={(e) => setIng(i, { unit: e.target.value })}
                className={inputCls + ' w-20'}
              />
              <button
                type="button"
                onClick={() => setD((p) => ({ ...p, ingredients: p.ingredients.filter((_, idx) => idx !== i) }))}
                className="text-zinc-600 hover:text-red-400 px-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setD((p) => ({ ...p, ingredients: [...p.ingredients, { item: '', qty: '', unit: '' }] }))}
          className="text-xs text-indigo-400 hover:text-indigo-300 mt-1.5 inline-flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Add ingredient
        </button>
      </div>

      <div>
        <p className="text-xs text-zinc-500 mb-1.5">Steps</p>
        <div className="space-y-1.5">
          {d.steps.map((s, i) => (
            <div key={i} className="flex gap-1.5 items-start">
              <span className="text-xs text-zinc-600 pt-2 w-4">{i + 1}.</span>
              <textarea
                value={s}
                rows={1}
                onChange={(e) =>
                  setD((p) => ({ ...p, steps: p.steps.map((x, idx) => (idx === i ? e.target.value : x)) }))
                }
                className={inputCls + ' flex-1 resize-none'}
              />
              <button
                type="button"
                onClick={() => setD((p) => ({ ...p, steps: p.steps.filter((_, idx) => idx !== i) }))}
                className="text-zinc-600 hover:text-red-400 px-1 pt-1.5"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setD((p) => ({ ...p, steps: [...p.steps, ''] }))}
          className="text-xs text-indigo-400 hover:text-indigo-300 mt-1.5 inline-flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Add step
        </button>
      </div>

      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Notes</label>
        <textarea value={d.notes} rows={2} onChange={(e) => setD({ ...d, notes: e.target.value })} className={inputCls} />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedAt ? <Check className="h-3.5 w-3.5" /> : null}
          {savedAt ? 'Saved' : 'Save recipe'}
        </Button>
      </div>
    </div>
  )
}
