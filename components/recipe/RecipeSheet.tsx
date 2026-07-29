'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { X, Minus, Plus, ChefHat, ShoppingCart, Check, Clock, ArrowRight, Play } from 'lucide-react'

interface Ingredient {
  id: string
  name: string
  amount: string
  unit: string
  checked?: boolean
}

interface RecipeStep {
  id: string
  stepNumber: number
  instruction: string
  timestampSeconds?: number
}

interface RecipeData {
  id: string
  title: string
  description?: string
  servings: number
  prepTime?: string
  cookTime?: string
  ingredients: Ingredient[]
  steps: RecipeStep[]
}

interface RecipeSheetProps {
  isOpen: boolean
  onClose: () => void
  recipe: RecipeData | null
  onCookMode?: () => void
}

const SERVING_OPTIONS = [1, 2, 4, 6, 8]

export default function RecipeSheet({ isOpen, onClose, recipe, onCookMode }: RecipeSheetProps) {
  const [servings, setServings] = useState(2)
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set())
  const [visible, setVisible] = useState(false)
  const dragStartY = useRef(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (isOpen && recipe) {
      setServings(recipe.servings)
      setCheckedIngredients(new Set())
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isOpen, recipe])

  const toggleIngredient = (id: string) => {
    setCheckedIngredients(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const scaleAmount = (amount: string): string => {
    const num = parseFloat(amount)
    if (isNaN(num)) return amount
    const scaled = (num / (recipe?.servings ?? 2)) * servings
    if (scaled === Math.round(scaled)) return String(Math.round(scaled))
    return scaled.toFixed(1)
  }

  const addToShoppingList = () => {
    if (!recipe) return
    const items = recipe.ingredients
      .filter(ing => checkedIngredients.has(ing.id))
      .map(ing => `${scaleAmount(ing.amount)} ${ing.unit} ${ing.name}`)
    if (items.length === 0) return
    try {
      const existing = JSON.parse(localStorage.getItem('hapieats_shopping_list') ?? '[]') as string[]
      localStorage.setItem('hapieats_shopping_list', JSON.stringify([...existing, ...items]))
    } catch { /* storage full */ }
  }

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true)
    dragStartY.current = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
  }

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return
    const y = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    setDragOffset(Math.max(0, y - dragStartY.current))
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    if (dragOffset > 100) onClose()
    setDragOffset(0)
  }

  if (!recipe) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 transition-transform duration-500 ease-out',
          isDragging ? 'transition-none' : '',
        )}
        style={{
          transform: visible
            ? `translateY(${dragOffset}px)`
            : 'translateY(105%)',
          height: '75vh',
          maxHeight: '75vh',
        }}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <div className="h-full rounded-t-3xl bg-card border border-b-0 border-foreground/10 overflow-hidden flex flex-col shadow-2xl">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1.5 rounded-full bg-foreground/20" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 shrink-0">
            <div className="min-w-0">
              <h3 className="font-bold text-lg truncate">{recipe.title}</h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {recipe.prepTime && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Prep: {recipe.prepTime}</span>}
                {recipe.cookTime && <span>Cook: {recipe.cookTime}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {onCookMode && (
                <Button size="sm" className="gap-1.5 rounded-full bg-cyan-600 hover:bg-cyan-700 text-xs h-8" onClick={onCookMode}>
                  <ChefHat className="h-3.5 w-3.5" /> Cook Mode
                </Button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-foreground/10 text-muted-foreground shrink-0">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Servings scaler */}
          <div className="flex items-center justify-center gap-3 py-2 shrink-0">
            <span className="text-xs text-muted-foreground font-medium">Servings</span>
            <div className="flex items-center gap-1 bg-foreground/5 rounded-full p-0.5">
              {SERVING_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => setServings(n)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-semibold transition-colors',
                    servings === n
                      ? 'bg-cyan-600 text-white'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-5">
            {/* Description */}
            {recipe.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{recipe.description}</p>
            )}

            {/* Ingredients */}
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Ingredients
              </h4>
              <ul className="space-y-2">
                {recipe.ingredients.map((ing) => (
                  <li key={ing.id}>
                    <button
                      onClick={() => toggleIngredient(ing.id)}
                      className={cn(
                        'w-full flex items-center gap-3 text-sm py-2 px-3 rounded-xl transition-colors text-left',
                        checkedIngredients.has(ing.id)
                          ? 'bg-cyan-500/10 border border-cyan-500/20 line-through text-muted-foreground/60'
                          : 'hover:bg-foreground/5 border border-transparent',
                      )}
                    >
                      <span className={cn(
                        'h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                        checkedIngredients.has(ing.id)
                          ? 'bg-cyan-500 border-cyan-500'
                          : 'border-foreground/20',
                      )}>
                        {checkedIngredients.has(ing.id) && <Check className="h-3 w-3 text-white" />}
                      </span>
                      <span className="font-medium w-16 shrink-0 text-right text-xs tabular-nums">
                        {scaleAmount(ing.amount)} {ing.unit}
                      </span>
                      <span className="flex-1">{ing.name}</span>
                    </button>
                  </li>
                ))}
              </ul>

              {checkedIngredients.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addToShoppingList}
                  className="mt-3 w-full gap-2 rounded-full text-xs"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Add {checkedIngredients.size} checked to shopping list
                </Button>
              )}
            </section>

            {/* Steps */}
            <section className="pb-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Steps
              </h4>
              <ol className="space-y-3">
                {recipe.steps.map((step) => (
                  <li key={step.id} className="flex gap-3">
                    <span className="h-6 w-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {step.stepNumber}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed">{step.instruction}</p>
                      {step.timestampSeconds != null && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                          <Play className="h-3 w-3" /> {(step.timestampSeconds / 60).toFixed(0)}:{String(step.timestampSeconds % 60).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
