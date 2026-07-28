'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { UserPlus, UserCheck } from 'lucide-react'

interface FollowButtonProps {
  creatorId: string
  initialFollowing: boolean
  isSignedIn: boolean
}

export default function FollowButton({ creatorId, initialFollowing, isSignedIn }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing)
  const [pending, setPending] = useState(false)

  if (!isSignedIn) {
    return (
      <Button asChild size="sm" className="gap-2">
        <Link href="/login">
          <UserPlus className="h-4 w-4" />
          Follow
        </Link>
      </Button>
    )
  }

  const toggle = async () => {
    if (pending) return
    const next = !following
    setFollowing(next)
    setPending(true)
    try {
      const res = next
        ? await fetch('/api/users/follow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorId }),
          })
        : await fetch(`/api/users/follow?creatorId=${encodeURIComponent(creatorId)}`, {
            method: 'DELETE',
          })
      if (!res.ok) setFollowing(!next)
    } catch {
      setFollowing(!next)
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      size="sm"
      variant={following ? 'outline' : 'default'}
      className="gap-2"
      onClick={toggle}
      disabled={pending}
    >
      {following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
      {following ? 'Following' : 'Follow'}
    </Button>
  )
}
