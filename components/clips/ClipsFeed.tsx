'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Clapperboard } from 'lucide-react'
import type { Clip, ClipsFeedKind, ClipsFeedResponse } from '@/lib/clips/types'
import ClipCard from './ClipCard'

const TABS: { kind: ClipsFeedKind; label: string }[] = [
  { kind: 'foryou', label: 'For You' },
  { kind: 'following', label: 'Following' },
  { kind: 'trending', label: 'Trending' },
]

const PAGE_SIZE = 10
/** Start fetching the next page when the active clip is this close to the end */
const PREFETCH_AHEAD = 3
/** A clip must stay visible this long before a view is counted */
const VIEW_DELAY_MS = 2000

export default function ClipsFeed({
  initialClipId,
  initialClip,
}: {
  /** Deep link: the clip to show first (feed continues below it) */
  initialClipId?: string
  initialClip?: Clip
}) {
  const [feed, setFeed] = useState<ClipsFeedKind>('foryou')
  const [clips, setClips] = useState<Clip[]>(initialClip ? [initialClip] : [])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(true)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<(HTMLElement | null)[]>([])
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const requestSeqRef = useRef(0)
  const cursorRef = useRef<string | null>(null)
  const clipsRef = useRef<Clip[]>(clips)
  const feedRef = useRef<ClipsFeedKind>(feed)
  /** persists the user's mute choice across clip changes */
  const mutedRef = useRef(true)
  /** clip ids that already had a view fired */
  const viewFiredRef = useRef<Set<string>>(new Set())
  const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeIndexRef = useRef(0)

  clipsRef.current = clips
  cursorRef.current = nextCursor
  feedRef.current = feed
  activeIndexRef.current = activeIndex

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      mutedRef.current = !prev
      return !prev
    })
  }, [])

  // ── Fetch a page ──────────────────────────────────────────────────────────
  const fetchPage = useCallback(
    async (kind: ClipsFeedKind, cursor: string | null, replace: boolean) => {
      // Pagination requests are deduped; replace requests (initial load / tab
      // switch) always win — they abort whatever is in flight so rapid tab
      // switches never end on an empty screen.
      if (!replace && loadingRef.current) return
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const seq = ++requestSeqRef.current
      loadingRef.current = true
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ feed: kind, limit: String(PAGE_SIZE) })
        if (cursor) params.set('cursor', cursor)
        const res = await fetch(`/api/clips?${params.toString()}`, { signal: controller.signal })
        if (seq !== requestSeqRef.current) return

        if (res.status === 401 && kind === 'following') {
          setNeedsLogin(true)
          if (replace) setClips([])
          setNextCursor(null)
          return
        }
        if (!res.ok) throw new Error(`Failed to load clips (${res.status})`)

        const data: ClipsFeedResponse = await res.json()
        if (seq !== requestSeqRef.current) return
        const incoming = Array.isArray(data.clips) ? data.clips : []

        setClips(prev => {
          const base = replace ? (initialClip && kind === 'foryou' && !initialLoaded ? prev : []) : prev
          const seen = new Set(base.map(c => c.id))
          return [...base, ...incoming.filter(c => !seen.has(c.id))]
        })
        setNextCursor(data.nextCursor ?? null)
      } catch (err) {
        // A newer request superseded this one — its state is not ours to touch
        if (controller.signal.aborted || seq !== requestSeqRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to load clips')
      } finally {
        if (seq === requestSeqRef.current) {
          loadingRef.current = false
          setLoading(false)
          setInitialLoaded(true)
        }
      }
    },
    [initialClip, initialLoaded]
  )

  // Abort any in-flight fetch on unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // Initial load
  useEffect(() => {
    fetchPage('foryou', null, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Tab switch ────────────────────────────────────────────────────────────
  const switchFeed = (kind: ClipsFeedKind) => {
    if (kind === feed) return
    setFeed(kind)
    setNeedsLogin(false)
    setClips([])
    setNextCursor(null)
    setActiveIndex(0)
    setInitialLoaded(false)
    if (viewTimerRef.current) clearTimeout(viewTimerRef.current)
    const el = containerRef.current
    if (el) el.scrollTop = 0
    fetchPage(kind, null, true)
  }

  // ── Active-clip detection (IntersectionObserver, threshold 0.6) ──────────
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.index)
            if (!Number.isNaN(idx)) setActiveIndex(idx)
          }
        }
      },
      { root: container, threshold: 0.6 }
    )

    sectionRefs.current.slice(0, clips.length).forEach(el => {
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [clips.length])

  // ── Infinite scroll sentinel ──────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    const sentinel = sentinelRef.current
    if (!container || !sentinel || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting) && cursorRef.current && !loadingRef.current) {
          fetchPage(feedRef.current, cursorRef.current, false)
        }
      },
      { root: container, rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchPage, clips.length])

  // Also prefetch when the active clip nears the end (keyboard nav can outrun the sentinel)
  useEffect(() => {
    if (
      clips.length > 0 &&
      activeIndex >= clips.length - PREFETCH_AHEAD &&
      cursorRef.current &&
      !loadingRef.current
    ) {
      fetchPage(feedRef.current, cursorRef.current, false)
    }
  }, [activeIndex, clips.length, fetchPage])

  // ── View tracking: POST once per clip after 2s of visibility ─────────────
  useEffect(() => {
    if (viewTimerRef.current) clearTimeout(viewTimerRef.current)
    const clip = clips[activeIndex]
    if (!clip || viewFiredRef.current.has(clip.id)) return

    viewTimerRef.current = setTimeout(() => {
      // Only count if this clip is still the active one
      if (activeIndexRef.current !== activeIndex) return
      if (viewFiredRef.current.has(clip.id)) return
      viewFiredRef.current.add(clip.id)
      fetch(`/api/clips/${clip.id}/view`, { method: 'POST' }).catch(() => {
        // Non-critical — allow a retry on a future visit to this clip
        viewFiredRef.current.delete(clip.id)
      })
    }, VIEW_DELAY_MS)

    return () => {
      if (viewTimerRef.current) clearTimeout(viewTimerRef.current)
    }
  }, [activeIndex, clips])

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const scrollToIndex = useCallback((idx: number) => {
    const el = sectionRefs.current[idx]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = Math.min(activeIndexRef.current + 1, clipsRef.current.length - 1)
        scrollToIndex(next)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = Math.max(activeIndexRef.current - 1, 0)
        scrollToIndex(prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scrollToIndex])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-[calc(100svh-48px)] sm:h-[calc(100svh-56px)] bg-black">
      {/* Tabs overlay */}
      <div className="absolute top-0 inset-x-0 z-30 flex justify-center pt-3 pb-6 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div className="flex items-center gap-1 pointer-events-auto" role="tablist" aria-label="Clips feed">
          {TABS.map(({ kind, label }) => (
            <button
              key={kind}
              role="tab"
              aria-selected={feed === kind}
              onClick={() => switchFeed(kind)}
              className={
                feed === kind
                  ? 'min-h-[40px] px-4 text-sm font-bold text-white border-b-2 border-white'
                  : 'min-h-[40px] px-4 text-sm font-medium text-white/60 border-b-2 border-transparent hover:text-white/90 transition-colors'
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Centered 9:16 column on large screens, edge-to-edge on mobile */}
      <div className="h-full w-full lg:max-w-[420px] lg:mx-auto">
        <div
          ref={containerRef}
          className="h-full w-full overflow-y-auto snap-y snap-mandatory touch-pan-y overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {clips.map((clip, i) => (
            <section
              key={clip.id}
              data-index={i}
              ref={el => {
                sectionRefs.current[i] = el
              }}
              className="h-full w-full snap-start relative"
              aria-label={clip.title}
            >
              <ClipCard
                clip={clip}
                isActive={i === activeIndex}
                muted={muted}
                onToggleMute={toggleMute}
                preload={Math.abs(i - activeIndex) <= 1}
              />
            </section>
          ))}

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />

          {/* Bottom loading indicator */}
          {loading && clips.length > 0 && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 text-white/60 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* ── Empty / loading / error states ── */}
      {needsLogin && feed === 'following' ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/90 text-center px-6">
          <Clapperboard className="h-10 w-10 text-zinc-500" />
          <p className="text-white font-semibold">See clips from creators you follow</p>
          <p className="text-sm text-zinc-400">Sign in to build your Following feed.</p>
          <Link
            href="/login?redirect=/clips"
            className="mt-2 min-h-[40px] inline-flex items-center px-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
          >
            Sign in
          </Link>
        </div>
      ) : !initialLoaded && loading ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <Loader2 className="h-8 w-8 text-white/60 animate-spin" aria-label="Loading clips" />
        </div>
      ) : initialLoaded && clips.length === 0 && !error ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black text-center px-6">
          <Clapperboard className="h-10 w-10 text-zinc-500" />
          <p className="text-white font-semibold">No clips yet</p>
          <p className="text-sm text-zinc-400">
            {feed === 'following'
              ? 'Follow some creators and their clips will show up here.'
              : 'Check back soon — tasty clips are on the way.'}
          </p>
        </div>
      ) : error && clips.length === 0 ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black text-center px-6">
          <p className="text-white font-semibold">Couldn&apos;t load clips</p>
          <p className="text-sm text-zinc-400">{error}</p>
          <button
            onClick={() => fetchPage(feed, null, true)}
            className="mt-2 min-h-[40px] px-6 rounded-full bg-zinc-800 text-white text-sm font-semibold border border-zinc-700"
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  )
}
