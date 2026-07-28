'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LikeButtonProps {
  videoId: string
  initialLiked: boolean
  initialCount: number
}

export default function LikeButton({ videoId, initialLiked, initialCount }: LikeButtonProps) {
  const router = useRouter()
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, setPending] = useState(false)

  const handleClick = async () => {
    if (pending) return
    setPending(true)

    // Optimistic update
    const nextLiked = !liked
    setLiked(nextLiked)
    setCount((c) => (nextLiked ? c + 1 : Math.max(c - 1, 0)))

    try {
      const res = await fetch(`/api/videos/${videoId}/like`, {
        method: nextLiked ? 'POST' : 'DELETE',
      })

      if (res.status === 401) {
        // Revert optimistic update and redirect to login
        setLiked(liked)
        setCount(count)
        router.push(`/login?redirect=/watch/${videoId}`)
        return
      }

      if (!res.ok) {
        // Revert on any other error
        setLiked(liked)
        setCount(count)
        return
      }

      const data = await res.json()
      // Sync server-authoritative count
      setCount(data.likeCount ?? count)
    } catch {
      // Revert on network error
      setLiked(liked)
      setCount(count)
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      aria-label={liked ? 'Unlike video' : 'Like video'}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
        'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        liked
          ? 'border-red-500 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900'
          : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Heart
        className={cn('h-4 w-4 transition-colors', liked && 'fill-current text-red-500')}
      />
      <span>{count}</span>
    </button>
  )
}
