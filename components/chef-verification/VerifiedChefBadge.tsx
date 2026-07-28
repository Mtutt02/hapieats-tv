import { ChefHat } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VerifiedChefBadgeProps {
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const sizeMap = {
  sm: { icon: 'h-3.5 w-3.5', container: 'gap-1 text-xs', padding: 'px-1.5 py-0.5' },
  md: { icon: 'h-4 w-4', container: 'gap-1.5 text-sm', padding: 'px-2 py-1' },
  lg: { icon: 'h-5 w-5', container: 'gap-2 text-base', padding: 'px-3 py-1.5' },
}

export default function VerifiedChefBadge({ size = 'md', showLabel = true, className }: VerifiedChefBadgeProps) {
  const s = sizeMap[size]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        'bg-amber-500/15 text-amber-500 border border-amber-500/30',
        s.container,
        s.padding,
        className
      )}
      title="Verified Chef — Verified culinary professional on HapiEats TV"
    >
      <ChefHat className={cn(s.icon, 'flex-shrink-0')} />
      {showLabel && <span>Verified Chef</span>}
    </span>
  )
}
