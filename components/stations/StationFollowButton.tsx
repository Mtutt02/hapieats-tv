'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Bell, BellOff } from 'lucide-react'

interface Props {
  stationId: string
  followerCount: number
}

export default function StationFollowButton({ stationId, followerCount: initialCount }: Props) {
  const [following, setFollowing] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    fetch(`/api/stations/${stationId}/follow`)
      .then(r => r.json())
      .then(d => {
        setFollowing(d.following ?? false)
        setChecked(true)
      })
      .catch(() => setChecked(true))
  }, [stationId])

  const toggle = async () => {
    setLoading(true)
    const res = await fetch(`/api/stations/${stationId}/follow`, {
      method: following ? 'DELETE' : 'POST',
    })
    if (res.ok) {
      const wasFollowing = following
      setFollowing(!wasFollowing)
      setCount(c => wasFollowing ? Math.max(0, c - 1) : c + 1)
    }
    setLoading(false)
  }

  if (!checked) {
    return (
      <Button size="sm" disabled className="gap-1.5 min-w-24">
        <Bell className="h-4 w-4" /> Follow
      </Button>
    )
  }

  return (
    <Button
      size="sm"
      variant={following ? 'outline' : 'default'}
      className="gap-1.5 min-w-24"
      onClick={toggle}
      disabled={loading}
    >
      {following ? (
        <><BellOff className="h-4 w-4" /> Following</>
      ) : (
        <><Bell className="h-4 w-4" /> Follow</>
      )}
    </Button>
  )
}
