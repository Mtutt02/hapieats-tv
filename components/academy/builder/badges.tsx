import { cn } from '@/lib/utils'
import type { CourseFormat, CourseLevel, PricingModel } from '@/lib/academy/types'

const base = 'text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap'

export function FormatBadge({ format }: { format: CourseFormat | string }) {
  const styles: Record<string, string> = {
    recorded: 'bg-blue-500/15 text-blue-300',
    live: 'bg-red-500/15 text-red-300',
    hybrid: 'bg-purple-500/15 text-purple-300',
  }
  return <span className={cn(base, styles[format] ?? 'bg-zinc-700 text-zinc-300')}>{format}</span>
}

export function LevelBadge({ level }: { level: CourseLevel | string }) {
  const styles: Record<string, string> = {
    beginner: 'bg-emerald-500/15 text-emerald-300',
    intermediate: 'bg-amber-500/15 text-amber-300',
    advanced: 'bg-orange-500/15 text-orange-300',
    professional: 'bg-rose-500/15 text-rose-300',
  }
  return <span className={cn(base, 'capitalize', styles[level] ?? 'bg-zinc-700 text-zinc-300')}>{level}</span>
}

export function PriceBadge({ pricing, price }: { pricing: PricingModel | string; price: number }) {
  if (pricing === 'free') return <span className={cn(base, 'bg-green-500/15 text-green-300')}>Free</span>
  if (pricing === 'pro_only') return <span className={cn(base, 'bg-indigo-500/15 text-indigo-300')}>Pro only</span>
  return <span className={cn(base, 'bg-zinc-700 text-zinc-200')}>${(price ?? 0).toFixed(2)}</span>
}

export function StatusBadge({ published }: { published: boolean }) {
  return (
    <span className={cn(base, published ? 'bg-green-500/15 text-green-300' : 'bg-yellow-500/15 text-yellow-300')}>
      {published ? 'Published' : 'Draft'}
    </span>
  )
}
