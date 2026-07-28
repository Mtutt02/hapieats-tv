import { ChefHat } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VerifiedChefBadgeProps {
  /** Show a full pill label alongside the icon (default: icon-only with tooltip) */
  showLabel?: boolean
  className?: string
}

export default function VerifiedChefBadge({ showLabel = false, className }: VerifiedChefBadgeProps) {
  return (
    <span
      title="Verified Chef"
      aria-label="Verified Chef"
      className={cn(
        'group relative inline-flex items-center gap-1 text-primary',
        className
      )}
    >
      {showLabel ? (
        <span className="inline-flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-full px-2 py-0.5 text-xs font-semibold text-primary">
          <ChefHat className="h-3.5 w-3.5" />
          Verified Chef
        </span>
      ) : (
        <>
          <ChefHat className="h-4 w-4" />
          {/* Tooltip */}
          <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background opacity-0 group-hover:opacity-100 transition-opacity">
            Verified Chef
          </span>
        </>
      )}
    </span>
  )
}
