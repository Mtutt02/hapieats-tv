'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

export const CUISINE_TAGS = [
  { label: 'All', emoji: '🍽️' },
  { label: 'Italian', emoji: '🍝' },
  { label: 'Mexican', emoji: '🌮' },
  { label: 'Asian', emoji: '🍜' },
  { label: 'Indian', emoji: '🍛' },
  { label: 'American', emoji: '🍔' },
  { label: 'Mediterranean', emoji: '🫒' },
  { label: 'BBQ', emoji: '🔥' },
  { label: 'Desserts', emoji: '🍫' },
  { label: 'Vegan', emoji: '🌱' },
  { label: 'Gluten-Free', emoji: '🌾' },
  { label: 'Keto', emoji: '🥑' },
  { label: 'Quick', emoji: '⚡' },
  { label: 'Date Night', emoji: '🕯️' },
  { label: 'Meal Prep', emoji: '📦' },
]

interface CuisineTagsProps {
  activeCuisine?: string
  onSelect?: (tag: string) => void
  className?: string
}

export default function CuisineTags({ activeCuisine, onSelect, className }: CuisineTagsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const current = activeCuisine ?? searchParams.get('cuisine') ?? 'All'

  const handleSelect = (label: string) => {
    if (onSelect) {
      onSelect(label)
      return
    }
    // Default: update URL search param
    const params = new URLSearchParams(searchParams.toString())
    if (label === 'All') {
      params.delete('cuisine')
    } else {
      params.set('cuisine', label)
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className={cn('flex gap-2 overflow-x-auto scrollbar-hide pb-1', className)}>
      {CUISINE_TAGS.map(({ label, emoji }) => (
        <button
          key={label}
          onClick={() => handleSelect(label)}
          className={cn(
            'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
            'whitespace-nowrap transition-all duration-200 border touch-manipulation min-h-[34px]',
            current === label
              ? 'bg-primary text-white border-primary shadow-sm shadow-primary/25'
              : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground bg-transparent'
          )}
        >
          <span className="text-sm leading-none">{emoji}</span>
          {label}
        </button>
      ))}
    </div>
  )
}
