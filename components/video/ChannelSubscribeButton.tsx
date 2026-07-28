'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Bell, BellOff } from 'lucide-react'

interface Channel {
  id: string
  name: string
  stripe_price_id: string | null
  subscription_price: number | null
}

interface Props {
  channel: Channel
  userId: string | null
  isSubscribed: boolean
}

export default function ChannelSubscribeButton({ channel, userId, isSubscribed: initial }: Props) {
  const [subscribed, setSubscribed] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubscribe = async () => {
    if (!userId) { window.location.href = '/login'; return }
    if (subscribed) return // TODO: manage subscription portal

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'creator_subscription',
          channelId: channel.id,
          channelName: channel.name,
          stripePriceId: channel.stripe_price_id,
          successUrl: `${window.location.origin}/channel/${encodeURIComponent(channel.name)}?subscribed=1`,
          cancelUrl: window.location.href,
        }),
      })
      const json = await res.json().catch(() => ({})) as { url?: string; error?: string }
      if (!res.ok) {
        setError(json.error ?? `Error ${res.status} — please try again`)
        return
      }
      if (json.url) window.location.href = json.url
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  if (subscribed) {
    return (
      <Button variant="outline" className="gap-2" disabled>
        <Bell className="h-4 w-4 text-primary" /> Subscribed
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Button onClick={handleSubscribe} disabled={loading} className="gap-2">
        <Bell className="h-4 w-4" />
        {loading ? 'Loading…' : 'Subscribe'}
        {!loading && channel.subscription_price && (
          <span className="opacity-80">· ${channel.subscription_price}/mo</span>
        )}
      </Button>
      {error && (
        <p className="text-destructive text-xs">{error}</p>
      )}
    </div>
  )
}
