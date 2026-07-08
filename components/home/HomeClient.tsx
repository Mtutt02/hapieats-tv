'use client'

import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import type { Video } from '@/types'
import { SampleVideo } from '@/lib/sample-data'
import { formatViews, formatDuration, getVideoThumbnail } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { SAMPLE_STATIONS } from '@/lib/sample-data'
import dynamic from 'next/dynamic'
import { ChevronRight, Flame, Clock } from 'lucide-react'
import CuisineTags, { CUISINE_TAGS } from '@/components/filters/CuisineTags'

const MuxPlayer = dynamic(() => import('@mux/mux-player-react'), { ssr: false })

interface HomeClientProps {
  dbVideos: Video[]
  sampleVideos: SampleVideo[]
  hasRealContent: boolean
  categories: string[]
  followedStationIds?: string[]
}

// ─── Category pill emojis ──────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
  All: '🍽️',
  Japanese: '🍣',
  'Street Food': '🌮',
  BBQ: '🔥',
  Baking: '🥐',
  Italian: '🍝',
  'Plant-Based': '🌱',
  Desserts: '🍫',
  Trending: '📈',
  Live: '📡',
  Classes: '🎓',
}

// ─── Touch device detection ────────────────────────────────────────────
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    setIsTouch(window.matchMedia('(hover: none) and (pointer: coarse)').matches)
  }, [])
  return isTouch
}

// ─── Long-press hook for mobile hold-to-preview ───────────────────────
function useLongPress(onActivate: () => void, onDeactivate: () => void, delayMs = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const activated = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    activated.current = false
    timerRef.current = setTimeout(() => {
      activated.current = true
      onActivate()
    }, delayMs)
  }, [onActivate, delayMs])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startPos.current) return
    const dx = e.touches[0].clientX - startPos.current.x
    const dy = e.touches[0].clientY - startPos.current.y
    // Cancel long-press if finger moves more than 12px (user is scrolling)
    if (Math.sqrt(dx * dx + dy * dy) > 12) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (activated.current) {
      e.preventDefault() // prevent tap navigation while preview was showing
      activated.current = false
      onDeactivate()
    }
  }, [onDeactivate])

  return { handleTouchStart, handleTouchMove, handleTouchEnd }
}

// ─── Sample video card ─────────────────────────────────────────────────
function SampleVideoCard({ video, isTouch }: { video: SampleVideo; isTouch: boolean }) {
  const [active, setActive] = useState(false)
  const enter = useCallback(() => setActive(true), [])
  const leave = useCallback(() => setActive(false), [])
  const { handleTouchStart, handleTouchMove, handleTouchEnd } = useLongPress(enter, leave)

  return (
    <Link href={`/watch/${video.id}`} className="group block">
      <div
        className={cn(
          'relative aspect-video rounded-xl overflow-hidden bg-muted mb-2.5',
          'transition-all duration-300',
          !isTouch && 'group-hover:ring-2 group-hover:ring-primary/60 group-hover:shadow-[0_0_20px_rgba(249,115,22,0.18)]',
          active && 'ring-2 ring-primary/60',
        )}
        onMouseEnter={isTouch ? undefined : enter}
        onMouseLeave={isTouch ? undefined : leave}
        onTouchStart={isTouch ? handleTouchStart : undefined}
        onTouchMove={isTouch ? handleTouchMove : undefined}
        onTouchEnd={isTouch ? handleTouchEnd : undefined}
      >
        <Image
          src={video.thumbnailUrl}
          alt={video.title}
          fill
          className={cn(
            'object-cover transition-all duration-500',
            active && (video.videoUrl || video.muxPlaybackId) ? 'opacity-0 scale-100' : 'opacity-100',
            !active && !isTouch ? 'group-hover:scale-[1.03]' : '',
          )}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {active && video.videoUrl && (
          <div className="absolute inset-0 z-10">
            <video
              src={video.videoUrl}
              autoPlay muted loop playsInline
              className="w-full h-full object-cover"
            />
          </div>
        )}
        {active && !video.videoUrl && video.muxPlaybackId && (
          <div className="absolute inset-0 z-10">
            <MuxPlayer
              playbackId={video.muxPlaybackId}
              muted autoPlay loop streamType="on-demand"
              style={{ '--controls': 'none', '--media-object-fit': 'contain', width: '100%', height: '100%' } as React.CSSProperties}
            />
          </div>
        )}
        {!active && (
          <span className="absolute bottom-2 right-2 bg-black/85 text-white text-[10px] px-1.5 py-0.5 rounded-md font-mono tracking-tight">
            {video.duration}
          </span>
        )}
      </div>
      {/* Meta — YouTube-style */}
      <div className="flex gap-2.5">
        <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5 ring-1 ring-border">
          <AvatarImage src={video.channelAvatar} />
          <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
            {video.channelName.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {video.title}
          </h3>
          <p className="text-muted-foreground text-xs mt-1 font-medium">{video.channelName}</p>
          <p className="text-muted-foreground text-xs">
            {formatViews(video.viewCount)} views · {formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </Link>
  )
}

// ─── Real video card ───────────────────────────────────────────────────
function RealVideoCard({ video, isTouch }: { video: Video; isTouch: boolean }) {
  const [active, setActive] = useState(false)
  const thumbnail = getVideoThumbnail(video.mux_playback_id, video.thumbnail_url, video.id)
  const enter = useCallback(() => setActive(true), [])
  const leave = useCallback(() => setActive(false), [])
  const { handleTouchStart, handleTouchMove, handleTouchEnd } = useLongPress(enter, leave)

  return (
    <Link href={`/watch/${video.id}`} className="group block">
      <div
        className={cn(
          'relative aspect-video rounded-xl overflow-hidden bg-muted mb-2.5',
          'transition-all duration-300',
          !isTouch && 'group-hover:ring-2 group-hover:ring-primary/60 group-hover:shadow-[0_0_20px_rgba(249,115,22,0.18)]',
          active && 'ring-2 ring-primary/60',
        )}
        onMouseEnter={isTouch ? undefined : enter}
        onMouseLeave={isTouch ? undefined : leave}
        onTouchStart={isTouch ? handleTouchStart : undefined}
        onTouchMove={isTouch ? handleTouchMove : undefined}
        onTouchEnd={isTouch ? handleTouchEnd : undefined}
      >
        <Image
          src={thumbnail}
          alt={video.title}
          fill
          className={cn(
            'object-cover transition-all duration-500',
            active && video.mux_playback_id ? 'opacity-0' : 'opacity-100',
            !active && !isTouch ? 'group-hover:scale-[1.03]' : '',
          )}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {active && video.mux_playback_id && (
          <div className="absolute inset-0 z-10">
            <MuxPlayer
              playbackId={video.mux_playback_id}
              muted autoPlay loop streamType="on-demand"
              style={{ '--controls': 'none', '--media-object-fit': 'contain', width: '100%', height: '100%' } as React.CSSProperties}
            />
          </div>
        )}
        {video.duration && !active && (
          <span className="absolute bottom-2 right-2 z-20 bg-black/85 text-white text-[10px] px-1.5 py-0.5 rounded-md font-mono tracking-tight">
            {formatDuration(video.duration)}
          </span>
        )}
        {video.pricing_model !== 'free' && !video.user_has_access && (
          <div className="absolute top-2 left-2 z-20 bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
            {video.pricing_model === 'pay_per_view' ? `$${((video.price ?? 0)).toFixed(2)}` : 'Members'}
          </div>
        )}
      </div>
      <div className="flex gap-2.5">
        <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5 ring-1 ring-border">
          <AvatarImage src={video.creator?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
            {(video.creator?.display_name ?? video.creator?.username ?? 'C').charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {video.title}
          </h3>
          <p className="text-muted-foreground text-xs mt-1 font-medium">
            {video.channel?.name ?? video.creator?.display_name}
          </p>
          <p className="text-muted-foreground text-xs">
            {formatViews(video.view_count)} views
            {video.published_at && <> · {formatDistanceToNow(new Date(video.published_at), { addSuffix: true })}</>}
          </p>
        </div>
      </div>
    </Link>
  )
}

// ─── Skeleton card (loading state) ────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="block">
      <div className="aspect-video rounded-xl bg-muted mb-2.5 animate-pulse" />
      <div className="flex gap-2.5">
        <div className="h-9 w-9 rounded-full bg-muted flex-shrink-0 animate-pulse" />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="h-3.5 bg-muted rounded-full w-full animate-pulse" />
          <div className="h-3.5 bg-muted rounded-full w-3/4 animate-pulse" />
          <div className="h-3 bg-muted/70 rounded-full w-1/2 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// ─── Section header ────────────────────────────────────────────────────
function SectionHeader({ emoji, title, href }: { emoji: string; title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-3 sm:mb-4">
      <h2 className="flex items-center gap-2 text-sm sm:text-base font-bold">
        <span className="text-lg leading-none">{emoji}</span>
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-0.5 text-xs text-primary hover:underline font-medium"
        >
          See all <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}

// ─── Station bubble (Instagram Stories style) ──────────────────────────
function StationBubble({ station }: { station: typeof SAMPLE_STATIONS[0] }) {
  return (
    <Link
      href={`/stations/${station.slug}`}
      className="group flex-shrink-0 flex flex-col items-center gap-1.5 w-16 sm:w-18"
    >
      {/* Outer glow ring */}
      <div className="p-0.5 rounded-full bg-gradient-to-br from-primary via-orange-400 to-pink-500 group-hover:from-pink-500 group-hover:to-primary transition-all duration-300">
        <div className="p-0.5 rounded-full bg-background">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden relative bg-muted">
            <Image
              src={station.coverUrl}
              alt={station.name}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-300"
              sizes="56px"
            />
            {/* Emoji overlay */}
            <div className="absolute inset-0 flex items-end justify-center pb-0.5 bg-gradient-to-t from-black/60 to-transparent">
              <span className="text-base leading-none">{station.icon}</span>
            </div>
          </div>
        </div>
      </div>
      <span className="text-[10px] sm:text-[11px] font-semibold text-center leading-tight line-clamp-1 w-full text-center">
        {station.name.split(' ')[0]}
      </span>
    </Link>
  )
}

// ─── Featured editorial card ───────────────────────────────────────────
function FeaturedCard({
  title, thumbnailUrl, channelName, views, href,
}: {
  title: string; thumbnailUrl: string; channelName: string; views: number | string; href: string
}) {
  return (
    <Link
      href={href}
      className="group relative block rounded-2xl overflow-hidden bg-card border border-border hover:border-primary/40 active:scale-[0.99] transition-all duration-300 hover:shadow-[0_0_32px_rgba(249,115,22,0.15)]"
    >
      <div className="aspect-[16/7] sm:aspect-[21/9] relative overflow-hidden">
        <Image
          src={thumbnailUrl}
          alt={title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-700"
          sizes="(max-width: 768px) 100vw, 90vw"
          priority
        />
        {/* Gradient overlay — heavier at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary text-white text-[10px] sm:text-xs font-bold rounded-full mb-2 sm:mb-3">
            <Flame className="h-3 w-3" />
            Featured
          </div>
          <h2 className="text-white text-sm sm:text-xl lg:text-2xl font-bold leading-snug line-clamp-2 group-hover:text-primary/90 transition-colors">
            {title}
          </h2>
          <p className="text-white/60 text-xs sm:text-sm mt-1.5 font-medium">
            {channelName} · {typeof views === 'number' ? formatViews(views) : views} views
          </p>
        </div>
      </div>
    </Link>
  )
}

// ─── Cooking time filter options ──────────────────────────────────────
const COOK_TIME_FILTERS = [
  { label: 'Any Time', icon: null },
  { label: 'Quick', description: '< 30 min', icon: '⚡' },
  { label: 'Medium', description: '30–60 min', icon: '⏱️' },
  { label: 'Long', description: '> 60 min', icon: '🕐' },
]

// ─── Main home page ────────────────────────────────────────────────────
export default function HomeClient({
  dbVideos,
  sampleVideos,
  hasRealContent,
  categories,
  followedStationIds = [],
}: HomeClientProps) {
  const [activeCategory, setActiveCategory] = useState('All')
  const [activeCuisine, setActiveCuisine] = useState('All')
  const [activeCookTime, setActiveCookTime] = useState('Any Time')
  const [showFollowing, setShowFollowing] = useState(false)
  const isTouch = useIsTouchDevice()

  const hasFollowed = followedStationIds.length > 0

  // Pick featured video
  const featuredVideo = hasRealContent ? dbVideos[0] : sampleVideos[0]

  // Apply "Following" filter — only real DB videos have station_id; sample videos are excluded
  const allGridVideos = hasRealContent ? dbVideos.slice(1) : sampleVideos.slice(1)
  const gridVideos = showFollowing && hasRealContent
    ? dbVideos.filter((v) => v.station_id && followedStationIds.includes(v.station_id))
    : allGridVideos

  return (
    <div className="pb-24 md:pb-8">

      {/* ── Sticky category pills — right at the top ──────────────── */}
      {/* top-12 = 48px (mobile TopBar height), sm:top-14 = 56px (desktop) */}
      <div className="sticky top-12 sm:top-14 z-30 bg-background/95 backdrop-blur-md border-b border-border/60">
        {/* ── Category pills ──────────────────────────────────────────── */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-3 sm:px-5 py-2.5">
          {/* Following filter — only shown for logged-in users who follow at least one station */}
          {hasFollowed && (
            <button
              onClick={() => { setShowFollowing(v => !v); setActiveCategory('All') }}
              className={cn(
                'flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-semibold',
                'whitespace-nowrap transition-all duration-200 border touch-manipulation min-h-[36px] flex-shrink-0',
                showFollowing
                  ? 'bg-primary text-primary-foreground border-primary scale-[1.03] shadow-sm'
                  : 'border-primary/40 text-primary hover:border-primary hover:bg-primary/5 active:scale-95 bg-transparent',
              )}
            >
              <span className="text-sm leading-none">📡</span>
              Following
            </button>
          )}
          {categories.map((cat) => {
            const emoji = CATEGORY_ICONS[cat] ?? '🍴'
            return (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setShowFollowing(false) }}
                className={cn(
                  'flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-semibold',
                  'whitespace-nowrap transition-all duration-200 border touch-manipulation min-h-[36px] flex-shrink-0',
                  activeCategory === cat && !showFollowing
                    ? 'bg-foreground text-background border-foreground scale-[1.03] shadow-sm'
                    : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground active:scale-95 bg-transparent',
                )}
              >
                <span className="text-sm leading-none">{emoji}</span>
                {cat}
              </button>
            )
          })}
        </div>

        {/* ── Cuisine filter — mobile: own scrollable row, desktop: with cook time ── */}
        <div className="border-t border-border/40">
          {/* Mobile only: cuisine strip alone */}
          <div className="sm:hidden px-3 py-2">
            <Suspense fallback={<div className="h-[34px]" />}>
              <CuisineTags activeCuisine={activeCuisine} onSelect={setActiveCuisine} />
            </Suspense>
          </div>

          {/* sm+: cuisine + cook time side by side */}
          <div className="hidden sm:flex items-center gap-3 px-5 py-2">
            <div className="flex-1 min-w-0">
              <Suspense fallback={<div className="h-[34px]" />}>
                <CuisineTags activeCuisine={activeCuisine} onSelect={setActiveCuisine} />
              </Suspense>
            </div>
            <div className="flex-shrink-0 flex items-center gap-1.5 border-l border-border/40 pl-3">
              <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              {COOK_TIME_FILTERS.map(({ label, icon }) => (
                <button
                  key={label}
                  onClick={() => setActiveCookTime(label)}
                  className={cn(
                    'whitespace-nowrap text-xs font-semibold px-2.5 py-1 rounded-full border transition-all min-h-[28px]',
                    activeCookTime === label
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  )}
                >
                  {icon && <span className="mr-0.5">{icon}</span>}{label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-5 py-4 sm:py-5 space-y-6 sm:space-y-8 max-w-[1600px] mx-auto">

        {/* ── Featured editorial hero ──────────────────────────────── */}
        {featuredVideo && activeCategory === 'All' && (
          <section>
            <FeaturedCard
              href={`/watch/${featuredVideo.id}`}
              title={featuredVideo.title}
              thumbnailUrl={'thumbnailUrl' in featuredVideo
                ? (featuredVideo as SampleVideo).thumbnailUrl
                : getVideoThumbnail((featuredVideo as Video).mux_playback_id, (featuredVideo as Video).thumbnail_url, featuredVideo.id)}
              channelName={'channelName' in featuredVideo
                ? (featuredVideo as SampleVideo).channelName
                : ((featuredVideo as Video).creator?.display_name ?? (featuredVideo as Video).channel?.name ?? 'HapiEats TV')}
              views={'viewCount' in featuredVideo
                ? (featuredVideo as SampleVideo).viewCount
                : (featuredVideo as Video).view_count}
            />
          </section>
        )}

        {/* ── Stations — Stories bubbles ────────────────────────────── */}
        {activeCategory === 'All' && (
          <section>
            <SectionHeader emoji="📡" title="Explore Stations" href="/stations" />
            <div className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide pb-1">
              {SAMPLE_STATIONS.map((station) => (
                <StationBubble key={station.id} station={station} />
              ))}
            </div>
          </section>
        )}

        {/* ── Sample content notice ─────────────────────────────────── */}
        {!hasRealContent && (
          <div className="px-4 py-3 rounded-xl bg-primary/8 border border-primary/20 text-xs sm:text-sm text-primary/90 flex items-start gap-2.5">
            <span className="text-lg mt-0.5 flex-shrink-0">🎬</span>
            <span>
              <strong>Sample content</strong> — upload your first video to see real content here.{' '}
              <Link href="/studio/upload" className="underline font-semibold">Upload now →</Link>
            </span>
          </div>
        )}

        {/* ── Main video grid ───────────────────────────────────────── */}
        <section>
          {showFollowing ? (
            <SectionHeader emoji="📡" title="Stations You Follow" href="/stations" />
          ) : activeCategory === 'All' ? (
            <SectionHeader emoji="🔥" title="Fresh Off the Grill" />
          ) : (
            <SectionHeader emoji={CATEGORY_ICONS[activeCategory] ?? '🍴'} title={activeCategory} />
          )}

          {showFollowing && gridVideos.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-3xl">📡</p>
              <p className="font-semibold">No videos yet from your followed stations</p>
              <p className="text-sm text-muted-foreground">
                The stations you follow haven't posted anything yet, or their videos are on your <a href="/stations" className="text-primary hover:underline">Stations page</a>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 sm:gap-x-5 gap-y-6 sm:gap-y-8">
              {hasRealContent && !showFollowing
                ? gridVideos.map((v) => <RealVideoCard key={v.id} video={v as Video} isTouch={isTouch} />)
                : showFollowing
                ? (gridVideos as Video[]).map((v) => <RealVideoCard key={v.id} video={v} isTouch={isTouch} />)
                : (gridVideos as SampleVideo[]).map((v) => <SampleVideoCard key={v.id} video={v} isTouch={isTouch} />)
              }
            </div>
          )}
        </section>

        {/* ── Second section — "You Might Like" ────────────────────── */}
        {activeCategory === 'All' && (
          <section>
            <SectionHeader emoji="✨" title="You Might Like" />
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 sm:gap-x-5 gap-y-6 sm:gap-y-8">
              {/* Show a staggered slice of videos for the "you might like" row */}
              {hasRealContent
                ? dbVideos.slice(0, 4).reverse().map((v) => <RealVideoCard key={`rec-${v.id}`} video={v} isTouch={isTouch} />)
                : sampleVideos.slice(0, 4).reverse().map((v) => <SampleVideoCard key={`rec-${v.id}`} video={v} isTouch={isTouch} />)
              }
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
