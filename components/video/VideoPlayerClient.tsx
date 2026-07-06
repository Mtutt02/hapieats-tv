'use client'

import { useState } from 'react'
import MuxPlayer from '@mux/mux-player-react'
import { Lock, DollarSign, CreditCard, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getVideoThumbnail } from '@/lib/utils'
import type { Video } from '@/types'

interface VideoPlayerClientProps {
  video: Video
  hasAccess: boolean
  userId: string | null
}

export default function VideoPlayerClient({ video, hasAccess, userId }: VideoPlayerClientProps) {
  const [loading, setLoading] = useState(false)

  const thumbnail = getVideoThumbnail(video.mux_playback_id, video.thumbnail_url)

  const handlePurchase = async (mode: 'pay_per_view' | 'creator_subscription' | 'platform_subscription') => {
    if (!userId) { window.location.href = `/login?redirect=/watch/${video.id}`; return }
    setLoading(true)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        videoId: video.id,
        channelId: video.channel_id,
        videoTitle: video.title,
        priceInCents: Math.round((video.price ?? 0) * 100),
        stripePriceId: video.channel?.stripe_price_id,
        channelName: video.channel?.name,
        successUrl: `${window.location.origin}/watch/${video.id}?success=1`,
        cancelUrl: window.location.href,
      }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    setLoading(false)
  }

  if (hasAccess && video.mux_playback_id) {
    return (
      <div className="rounded-2xl overflow-hidden bg-black aspect-video">
        <MuxPlayer
          playbackId={video.mux_playback_id}
          metadata={{ video_title: video.title, viewer_user_id: userId ?? undefined }}
          streamType="on-demand"
          className="w-full h-full"
          thumbnailTime={0}
        />
      </div>
    )
  }

  // Free video but no Mux ID yet — show thumbnail placeholder, not a paywall
  if (hasAccess && !video.mux_playback_id) {
    return (
      <div className="relative rounded-2xl overflow-hidden aspect-video bg-black">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: `url(${thumbnail})` }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <Clock className="h-10 w-10 text-primary" />
          <h2 className="text-xl font-bold text-white">Video Coming Soon</h2>
          <p className="text-white/60 text-sm">This video is being processed and will be available shortly.</p>
        </div>
      </div>
    )
  }

  // Paywall — paid content the user hasn't purchased
  return (
    <div className="relative rounded-2xl overflow-hidden aspect-video bg-black">
      {/* Blurred thumbnail */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-sm scale-110 opacity-40"
        style={{ backgroundImage: `url(${thumbnail})` }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-center text-white">
          <Lock className="h-10 w-10 mx-auto mb-3 text-primary" />
          <h2 className="text-xl font-bold">
            {video.pricing_model === 'pay_per_view' ? 'Purchase to Watch' : 'Subscribe to Watch'}
          </h2>
          <p className="text-white/70 text-sm mt-1">
            {video.pricing_model === 'pay_per_view'
              ? `One-time purchase: $${video.price?.toFixed(2)}`
              : `Get access with a ${video.channel?.name} subscription`}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          {video.pricing_model === 'pay_per_view' && (
            <Button
              onClick={() => handlePurchase('pay_per_view')}
              disabled={loading}
              className="flex-1 gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Buy for ${video.price?.toFixed(2)}
            </Button>
          )}
          {video.pricing_model === 'subscription' && (
            <Button
              onClick={() => handlePurchase('creator_subscription')}
              disabled={loading}
              className="flex-1 gap-2"
            >
              <CreditCard className="h-4 w-4" />
              Subscribe to {video.channel?.name}
              {video.channel?.subscription_price && (
                <span className="opacity-80"> · ${video.channel.subscription_price}/mo</span>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => handlePurchase('platform_subscription')}
            disabled={loading}
            className="flex-1 border-white/30 text-white hover:bg-white/10 gap-2"
          >
            <CreditCard className="h-4 w-4" />
            All-access Pass
          </Button>
        </div>

        {!userId && (
          <p className="text-white/50 text-xs">
            <a href={`/login?redirect=/watch/${video.id}`} className="underline">Sign in</a> to access your purchases
          </p>
        )}
      </div>
    </div>
  )
}
