'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TriedThisButtonProps {
  videoId: string
  initialTried: boolean
  initialCount: number
}

export default function TriedThisButton({ videoId, initialTried, initialCount }: TriedThisButtonProps) {
  const router = useRouter()
  const [tried, setTried] = useState(initialTried)
  const [count, setCount] = useState(initialCount)
  const [pending, setPending] = useState(false)

  const handleClick = async () => {
    if (pending) return
    setPending(true)

    // Optimistic update
    const nextTried = !tried
    setTried(nextTried)
    setCount((c) => (nextTried ? c + 1 : Math.max(c - 1, 0)))

    try {
      const res = await fetch(`/api/videos/${videoId}/tried`, { method: 'POST' })

      if (res.status === 401) {
        setTried(tried)
        setCount(count)
        router.push(`/login?redirect=/watch/${videoId}`)
        return
      }

      if (!res.ok) {
        setTried(tried)
        setCount(count)
        return
      }

      const data = await res.json()
      setTried(data.tried)
      setCount(data.triedCount ?? count)
    } catch {
      setTried(tried)
      setCount(count)
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      aria-label={tried ? 'Remove "Tried This" mark' : 'Mark as Tried This Recipe'}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
        'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        tried
          ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20'
          : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <CheckCircle2
        className={cn('h-4 w-4 transition-colors', tried && 'fill-primary/20 text-primary')}
      />
      <span>{tried ? 'Tried This' : 'Tried This?'}</span>
      {count > 0 && (
        <span className={cn(
          'text-xs rounded-full px-1.5 py-0.5 font-semibold',
          tried ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
        )}>
          {count}
        </span>
      )}
    </button>
  )
}
