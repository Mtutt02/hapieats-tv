'use client'

import { useMemo, useState } from 'react'
import type { Recipe, Ingredient } from '@/lib/academy/types'

/** Scale a numeric-ish qty string by `factor`, preserving non-numeric text. */
function scaleQty(qty: string | undefined, factor: number): string {
  if (!qty) return ''
  if (factor === 1) return qty
  // Replace leading number (incl. simple fractions like 1/2 or 1 1/2) with scaled value.
  return qty.replace(/^\s*(\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?)/, (match) => {
    const value = parseFraction(match.trim())
    if (value == null) return match
    const scaled = value * factor
    return formatNumber(scaled)
  })
}

function parseFraction(s: string): number | null {
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
  const frac = s.match(/^(\d+)\/(\d+)$/)
  if (frac) return Number(frac[1]) / Number(frac[2])
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function formatNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

export default function RecipePanel({ recipe }: { recipe: Recipe | null | undefined }) {
  const baseServings = recipe?.servings && recipe.servings > 0 ? recipe.servings : null
  const [servings, setServings] = useState<number>(baseServings ?? 1)
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const factor = baseServings ? servings / baseServings : 1

  const ingredients = useMemo<Ingredient[]>(() => recipe?.ingredients ?? [], [recipe])

  if (!recipe) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
        No recipe attached to this lesson.
      </div>
    )
  }

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 print:border-0 print:bg-white print:text-black">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800 p-4 print:border-black">
        <div>
          <h3 className="text-base font-semibold text-zinc-100 print:text-black">{recipe.title}</h3>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-400 print:text-black">
            {recipe.prep_minutes != null && <span>Prep {recipe.prep_minutes}m</span>}
            {recipe.cook_minutes != null && <span>Cook {recipe.cook_minutes}m</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex-none rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 print:hidden"
        >
          Print
        </button>
      </div>

      {baseServings && (
        <div className="flex items-center justify-between border-b border-zinc-800 p-4 print:border-black">
          <span className="text-sm text-zinc-300 print:text-black">Servings</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              className="h-7 w-7 rounded-md border border-zinc-700 text-zinc-200 hover:bg-zinc-800 print:hidden"
              aria-label="Decrease servings"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-semibold text-zinc-100 print:text-black">{servings}</span>
            <button
              type="button"
              onClick={() => setServings((s) => s + 1)}
              className="h-7 w-7 rounded-md border border-zinc-700 text-zinc-200 hover:bg-zinc-800 print:hidden"
              aria-label="Increase servings"
            >
              +
            </button>
          </div>
        </div>
      )}

      <div className="p-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 print:text-black">
          Ingredients
        </h4>
        <ul className="space-y-1.5">
          {ingredients.map((ing, i) => {
            const qty = [scaleQty(ing.qty, factor), ing.unit].filter(Boolean).join(' ')
            return (
              <li key={i} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked.has(i)}
                  onChange={() => toggle(i)}
                  className="mt-0.5 accent-emerald-500"
                />
                <span
                  className={`text-zinc-200 print:text-black ${checked.has(i) ? 'text-zinc-500 line-through' : ''}`}
                >
                  {qty && <span className="font-medium">{qty} </span>}
                  {ing.item}
                  {ing.note && <span className="text-zinc-500"> ({ing.note})</span>}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {recipe.steps?.length > 0 && (
        <div className="border-t border-zinc-800 p-4 print:border-black">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 print:text-black">
            Steps
          </h4>
          <ol className="space-y-3">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-zinc-200 print:text-black">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300 print:bg-transparent print:text-black">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {recipe.notes && (
        <div className="border-t border-zinc-800 p-4 text-sm text-zinc-400 print:border-black print:text-black">
          <span className="font-medium text-zinc-300 print:text-black">Notes: </span>
          {recipe.notes}
        </div>
      )}
    </div>
  )
}
