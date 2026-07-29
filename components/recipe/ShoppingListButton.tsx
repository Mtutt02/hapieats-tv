'use client'

import React, { useState, useEffect } from 'react'
import { ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'hapieats_shopping_list'

export function getShoppingList(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

export function clearShoppingList() {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, '[]') } catch { /* */ }
}

export default function ShoppingListButton() {
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setCount(getShoppingList().length)
    const handler = () => setCount(getShoppingList().length)
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const items = getShoppingList()

  return (
    <>
      <button
        onClick={() => { setOpen(!open); setCount(getShoppingList().length) }}
        className={cn(
          'fixed bottom-20 right-4 z-30 h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-all',
          count > 0
            ? 'bg-cyan-600 text-white shadow-cyan-600/30'
            : 'bg-card border border-foreground/10 text-muted-foreground',
        )}
        title="Shopping List"
      >
        <ShoppingCart className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed bottom-0 right-4 z-50 w-80 max-h-[50vh] rounded-t-3xl bg-card border border-b-0 border-foreground/10 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/5">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-cyan-400" />
                Shopping List
              </h4>
              {items.length > 0 && (
                <button
                  onClick={() => { clearShoppingList(); setCount(0) }}
                  className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No items yet. Check ingredients from a Recipe Sheet and tap "Add to shopping list."
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg hover:bg-foreground/5">
                      <span className="h-4 w-4 rounded border border-foreground/20 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
