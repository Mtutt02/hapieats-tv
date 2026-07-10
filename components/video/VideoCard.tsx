'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { formatDuration, formatViews, getVideoThumbnail } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { Lock, DollarSign, Play } from 'lucide-react'
import type { Video } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

// Lazy-loaded so the MuxPlayer bundle doesn't bloat the initial page load
const MuxPlayer = dynamic(() => import('@mux/mux-player-react'), { ssr: false })

// ── Touch device detection ────────────────────────────────────────────────
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    setIsTouch(window.matchMedia('(hover: none) and (pointer: coarse)').matches)
  }, [])
  return isTouch
}

// ── Long-press hook (500ms hold to preview, cancel if finger moves >12px) ─
function useLongPress(onActivate: () => void, onDeactivate: () => void, delayMs = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const activated = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    startPos.current = { x: touch.clientX, y: touch.clientY }
    activated.current = false
    timerRef.current = setTimeout(() => {
      activated.current = true
      onActivate()
    }, delayMs)
  }, [onActivate, delayMs])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startPos.current) return
    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - startPos.current.x)
    const dy = Math.abs(touch.clientY - startPos.current.y)
    if (dx > 12 || dy > 12) {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (activated.current) onDeactivate()
      activated.current = false
    }
  }, [onDeactivate])

  const handleTouchEnd = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (activated.current) {
      onDeactivate()
      activated.current = false
    }
  }, [onDeactivate])

  return { handleTouchStart, handleTouchMove, handleTouchEnd }
}

interface VideoCardProps {
  video: Video
  compact?: boolean
}

export default function VideoCard({ video, compact = false }: VideoCardProps) {
  const [hovered, setHovered] = useState(false)
  const isTouch = useIsTouchDevice()
  const { handleTouchStart, handleTouchMove, handleTouchEnd } = useLongPress(
    () => setHovered(true),
    () => setHovered(false),
  )

  // Mouse handlers only fire on non-touch devices (avoids double-trigger)
  const mouseHandlers = isTouch
    ? {}
    : { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }

  const touchHandlers = isTouch
    ? { onTouchStart: handleTouchStart, onTouchMove: handleTouchMove, onTouchEnd: handleTouchEnd }
    : {}
  const thumbnail = getVideoThumbnail(video.mux_playback_id, video.thumbnail_url, video.id)
  const isPaid = video.pricing_model === 'pay_per_view' || video.pricing_model === 'subscription'

  // ── Compact (sidebar / related) ──────────────────────────────────────
  if (compact) {
    return (
      <Link href={`/watch/${video.id}`} className="group flex gap-2 items-start">
        <div
          className="relative w-28 aspect-video rounded-lg overflow-hidden bg-black flex-shrink-0"
          {...mouseHandlers}
          {...touchHandlers}
        >
          <Image
            src={thumbnail}
            alt={video.title}
            fill
            className={cn(
              'object-contain transition-all duration-300',
              hovered && video.mux_playback_id ? 'opacity-0' : 'opacity-100',
              hovered && !video.mux_playback_id ? 'scale-105' : 'scale-100',
            )}
            sizes="112px"
          />
          {hovered && video.mux_playback_id && (
            <div className="absolute inset-0">
              <MuxPlayer
                playbackId={video.mux_playback_id}
                muted
                autoPlay
                loop
                streamType="on-demand"
                style={{
                  '--controls': 'none',
                  '--media-object-fit': 'contain',
                  width: '100%',
                  height: '100%',
                } as React.CSSProperties}
              />
            </div>
          )}
          {hovered && !video.mux_playback_id && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25 z-10">
              <div className="h-8 w-8 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center border border-white/40">
                <Play className="h-4 w-4 text-white fill-white ml-0.5" />
              </div>
            </div>
          )}
          {video.duration && !hovered && (
            <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded font-mono leading-none">
              {formatDuration(video.duration)}
            </span>
          )}
          {isPaid && !video.user_has_access && (
            <div className="absolute top-1 left-1 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none">
              {video.pricing_model === 'pay_per_view' ? `$${((video.price ?? 0)).toFixed(2)}` : 'Sub'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-xs leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {video.title}
          </h3>
          <p className="text-muted-foreground text-xs mt-0.5 truncate">
            {video.channel?.name ?? video.creator?.display_name}
          </p>
          <p className="text-muted-foreground text-[10px]">
            {formatViews(video.view_count)} views
          </p>
        </div>
      </Link>
    )
  }

  // ── Standard card ─────────────────────────────────────────────────────
  return (
    <Link href={`/watch/${video.id}`} className="group block">
      <div
        className="relative aspect-video rounded-xl overflow-hidden bg-black mb-3"
        {...mouseHandlers}
        {...touchHandlers}
      >
        {/* Static thumbnail — fades out when video loads, zooms on hover */}
        <Image
          src={thumbnail}
          alt={video.title}
          fill
          className={cn(
            'object-contain transition-all duration-300',
            hovered && video.mux_playback_id ? 'opacity-0 scale-100' : '',
            hovered && !video.mux_playback_id ? 'scale-105' : 'scale-100',
          )}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />

        {/* Inline video preview via MuxPlayer — mounted only on hover */}
        {hovered && video.mux_playback_id && (
          <div className="absolute inset-0 z-10">
            <MuxPlayer
              playbackId={video.mux_playback_id}
              muted
              autoPlay
              loop
              streamType="on-demand"
              style={{
                '--controls': 'none',
                '--media-object-fit': 'contain',
                width: '100%',
                height: '100%',
              } as React.CSSProperties}
            />
          </div>
        )}

        {/* Hover overlay — play button (when no Mux preview available) */}
        {hovered && !video.mux_playback_id && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 transition-opacity duration-200">
            <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-lg">
              <Play className="h-7 w-7 text-white fill-white ml-1" />
            </div>
          </div>
        )}

        {/* Duration badge — hide while video plays */}
        {video.duration && !hovered && (
          <span className="absolute bottom-2 right-2 z-20 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
            {formatDuration(video.duration)}
          </span>
        )}

        {/* Paywall badge */}
        {isPaid && !video.user_has_access && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-primary text-white text-xs px-2 py-0.5 rounded-full font-medium">
            {video.pricing_model === 'pay_per_view' ? (
              <><DollarSign className="h-3 w-3" />${((video.price ?? 0)).toFixed(2)}</>
            ) : (
              <><Lock className="h-3 w-3" />Members</>
            )}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex gap-3">
        <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
          <AvatarImage src={video.creator?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {video.creator?.display_name?.charAt(0) ?? video.creator?.username?.charAt(0) ?? 'C'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {video.title}
          </h3>
          <p className="text-muted-foreground text-xs mt-1">
            {video.channel?.name ?? video.creator?.display_name}
          </p>
          <p className="text-muted-foreground text-xs">
            {formatViews(video.view_count)} views
            {video.published_at && (
              <> · {formatDistanceToNow(new Date(video.published_at), { addSuffix: true })}</>
            )}
          </p>
        </div>
      </div>
    </Link>
  )
}
