'use client'

import { useEffect, useState } from 'react'
import type { ShoppingItem } from '@/lib/academy/types'

/**
 * ShoppingList — whole-course aggregated grocery list.
 * Loads from GET /api/academy/courses/[id]/shopping-list (de-duplicated
 * server-side via buildShoppingList) and persists per-item checks via POST.
 */
export default function ShoppingList({ courseId }: { courseId: string }) {
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/academy/courses/${courseId}/shopping-list`)
        const data = await res.json().catch(() => ({}))
        if (alive) setItems(Array.isArray(data?.items) ? data.items : [])
      } catch {
        if (alive) setItems([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [courseId])

  async function toggle(key: string) {
    let nextChecked = false
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it
        nextChecked = !it.checked
        return { ...it, checked: nextChecked }
      }),
    )
    try {
      await fetch(`/api/academy/courses/${courseId}/shopping-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_key: key, checked: nextChecked }),
      })
    } catch {
      /* best-effort persistence */
    }
  }

  async function copyList() {
    const text = items.map((it) => `${it.checked ? '[x]' : '[ ]'} ${[it.qty, it.item].filter(Boolean).join(' ')}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  if (loading) {
    return <div className="h-24 animate-pulse rounded-lg bg-zinc-900" />
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
        No ingredients yet — recipes will populate your shopping list.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 print:border-0 print:bg-white print:text-black">
      <div className="flex items-center justify-between border-b border-zinc-800 p-4 print:border-black">
        <h3 className="text-base font-semibold text-zinc-100 print:text-black">Shopping list</h3>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={copyList}
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            {copied ? 'Copied!' : 'Copy list'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Print
          </button>
        </div>
      </div>
      <ul className="divide-y divide-zinc-800 print:divide-black">
        {items.map((it) => (
          <li key={it.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={!!it.checked}
              onChange={() => toggle(it.key)}
              className="accent-emerald-500"
            />
            <span className={`flex-1 text-zinc-200 print:text-black ${it.checked ? 'text-zinc-500 line-through' : ''}`}>
              {it.item}
            </span>
            {it.qty && <span className="text-xs text-zinc-500 print:text-black">{it.qty}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
