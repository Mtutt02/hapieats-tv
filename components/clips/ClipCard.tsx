'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Flag,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { type Clip, clipShareUrl, clipThumbnail } from '@/lib/clips/types'
import CommentsDrawer from './CommentsDrawer'

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

// ─── Lazy Mux player (loaded only when a clip becomes active) ─────────────────
function LazyMuxPlayer({ playbackId, muted, poster }: { playbackId: string; muted: boolean; poster: string }) {
  const [MuxPlayer, setMuxPlayer] = useState<React.ComponentType<Record<string, unknown>> | null>(null)

  useEffect(() => {
    let cancelled = false
    import('@mux/mux-player-react').then(m => {
      if (!cancelled) setMuxPlayer(() => m.default)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!MuxPlayer) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-white/60 animate-spin" aria-label="Loading video" />
      </div>
    )
  }

  return (
    <MuxPlayer
      playbackId={playbackId}
      streamType="on-demand"
      autoPlay
      muted={muted}
      loop
      playsInline
      poster={poster}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        // Hide every native Mux control — the feed provides its own UI
        '--controls': 'none',
        '--media-object-fit': 'cover',
      } as React.CSSProperties}
    />
  )
}

function CreatorAvatar({ clip }: { clip: Clip }) {
  const name = clip.creator.display_name || clip.creator.username
  if (clip.creator.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={clip.creator.avatar_url}
        alt={name}
        className="h-10 w-10 rounded-full object-cover border-2 border-white/80 bg-zinc-800"
      />
    )
  }
  return (
    <div className="h-10 w-10 rounded-full bg-zinc-700 border-2 border-white/80 flex items-center justify-center text-sm font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function ClipCard({
  clip,
  isActive,
  muted,
  onToggleMute,
}: {
  clip: Clip
  isActive: boolean
  muted: boolean
  onToggleMute: () => void
}) {
  // ── Like (optimistic) ──
  const [liked, setLiked] = useState(Boolean(clip.liked))
  const [likeCount, setLikeCount] = useState(clip.like_count)
  const likeBusy = useRef(false)

  // ── Follow ──
  const [following, setFollowing] = useState(Boolean(clip.following))
  const followBusy = useRef(false)

  // ── UI ──
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(clip.comment_count)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }

  const toggleLike = async () => {
    if (likeBusy.current) return
    likeBusy.current = true
    const prevLiked = liked
    const prevCount = likeCount
    // Optimistic flip
    setLiked(!prevLiked)
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1)
    try {
      const res = await fetch(`/api/videos/${clip.id}/like`, {
        method: prevLiked ? 'DELETE' : 'POST',
      })
      if (res.status === 401) {
        setLiked(prevLiked)
        setLikeCount(prevCount)
        showToast('Sign in to like clips')
        return
      }
      if (!res.ok) throw new Error('Like failed')
      const data = await res.json()
      // Reconcile with server truth: { liked, likeCount }
      if (typeof data.liked === 'boolean') setLiked(data.liked)
      if (typeof data.likeCount === 'number') setLikeCount(data.likeCount)
    } catch {
      setLiked(prevLiked)
      setLikeCount(prevCount)
      showToast('Something went wrong')
    } finally {
      likeBusy.current = false
    }
  }

  const toggleFollow = async () => {
    if (followBusy.current) return
    followBusy.current = true
    const prev = following
    setFollowing(!prev)
    try {
      const res = prev
        ? await fetch(`/api/users/follow?creatorId=${encodeURIComponent(clip.creator.id)}`, { method: 'DELETE' })
        : await fetch('/api/users/follow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorId: clip.creator.id }),
          })
      if (res.status === 401) {
        setFollowing(prev)
        showToast('Sign in to follow creators')
        return
      }
      if (!res.ok) throw new Error('Follow failed')
    } catch {
      setFollowing(prev)
      showToast('Something went wrong')
    } finally {
      followBusy.current = false
    }
  }

  const share = async () => {
    const url = clipShareUrl(clip.id)
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: clip.title, url })
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        showToast('Link copied to clipboard')
        return
      }
      showToast(url)
    } catch {
      // User cancelled the share sheet — no toast needed
    }
  }

  const report = async () => {
    setMenuOpen(false)
    if (typeof window === 'undefined') return
    const reason = window.prompt('Why are you reporting this clip?')
    if (!reason || !reason.trim()) return
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: clip.id, type: 'video', reason: reason.trim() }),
      })
      if (res.status === 401) {
        showToast('Sign in to report content')
        return
      }
      if (!res.ok) throw new Error('Report failed')
      showToast('Report submitted — thank you')
    } catch {
      showToast('Could not submit report')
    }
  }

  const poster = clipThumbnail(clip.mux_playback_id)
  const creatorName = clip.creator.display_name || clip.creator.username

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* ── Video / poster layer ── */}
      {isActive ? (
        <div className="absolute inset-0">
          <LazyMuxPlayer playbackId={clip.mux_playback_id} muted={muted} poster={poster} />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt={clip.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      )}

      {/* Bottom gradient for legibility */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

      {/* ── Tap-to-unmute pill ── */}
      {isActive && muted && (
        <button
          onClick={onToggleMute}
          aria-label="Unmute"
          className="absolute left-1/2 -translate-x-1/2 bottom-48 md:bottom-32 z-20 flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-full bg-black/70 border border-white/20 text-white text-sm font-medium backdrop-blur-sm active:scale-95 transition-transform"
        >
          <VolumeX className="h-4 w-4" />
          Tap to unmute
        </button>
      )}
      {isActive && !muted && (
        <button
          onClick={onToggleMute}
          aria-label="Mute"
          className="absolute top-16 right-3 z-20 h-10 w-10 flex items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
        >
          <Volume2 className="h-5 w-5" />
        </button>
      )}

      {/* ── Bottom-left: creator + title ── */}
      <div className="absolute left-3 right-20 bottom-20 md:bottom-4 z-10 flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <Link href={`/channel/${clip.creator.username}`} aria-label={`View ${creatorName}'s channel`}>
            <CreatorAvatar clip={clip} />
          </Link>
          <div className="min-w-0">
            <Link
              href={`/channel/${clip.creator.username}`}
              className="text-white text-sm font-semibold truncate block drop-shadow"
            >
              @{clip.creator.username}
            </Link>
          </div>
          <button
            onClick={toggleFollow}
            aria-label={following ? `Unfollow ${creatorName}` : `Follow ${creatorName}`}
            className={
              following
                ? 'min-h-[40px] px-3.5 rounded-full text-xs font-semibold border border-white/40 text-white/90 bg-white/10 backdrop-blur-sm shrink-0'
                : 'min-h-[40px] px-3.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground shrink-0'
            }
          >
            {following ? 'Following' : 'Follow'}
          </button>
        </div>
        <p className="text-white text-sm leading-snug line-clamp-2 drop-shadow">{clip.title}</p>
        {clip.clip_category && (
          <span className="self-start text-[11px] font-medium uppercase tracking-wide text-white/90 bg-white/15 border border-white/20 rounded-full px-2.5 py-0.5 backdrop-blur-sm">
            {clip.clip_category}
          </span>
        )}
      </div>

      {/* ── Right-side action rail ── */}
      <div className="absolute right-2 bottom-24 md:bottom-6 z-10 flex flex-col items-center gap-4">
        <div className="flex flex-col items-center">
          <button
            onClick={toggleLike}
            aria-label={liked ? 'Unlike this clip' : 'Like this clip'}
            aria-pressed={liked}
            className="h-12 w-12 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm active:scale-90 transition-transform"
          >
            <Heart
              className={liked ? 'h-7 w-7 text-red-500 fill-red-500' : 'h-7 w-7 text-white'}
            />
          </button>
          <span className="text-white text-xs font-semibold mt-1 drop-shadow">{formatCount(likeCount)}</span>
        </div>

        <div className="flex flex-col items-center">
          <button
            onClick={() => setShowComments(true)}
            aria-label="View comments"
            className="h-12 w-12 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm active:scale-90 transition-transform"
          >
            <MessageCircle className="h-7 w-7 text-white" />
          </button>
          <span className="text-white text-xs font-semibold mt-1 drop-shadow">{formatCount(commentCount)}</span>
        </div>

        <div className="flex flex-col items-center">
          <button
            onClick={share}
            aria-label="Share this clip"
            className="h-12 w-12 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm active:scale-90 transition-transform"
          >
            <Share2 className="h-7 w-7 text-white" />
          </button>
          <span className="text-white text-xs font-semibold mt-1 drop-shadow">Share</span>
        </div>

        <div className="relative flex flex-col items-center">
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="More options"
            aria-expanded={menuOpen}
            className="h-12 w-12 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm active:scale-90 transition-transform"
          >
            <MoreHorizontal className="h-7 w-7 text-white" />
          </button>
          {menuOpen && (
            <div className="absolute bottom-14 right-0 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-30 min-w-[140px]">
              <button
                onClick={report}
                className="flex items-center gap-2 w-full min-h-[44px] px-4 text-sm text-red-400 hover:bg-zinc-800 transition-colors"
              >
                <Flag className="h-4 w-4" />
                Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 top-20 z-30 bg-black/80 text-white text-sm px-4 py-2 rounded-full border border-white/20 backdrop-blur-sm whitespace-nowrap max-w-[90%] truncate">
          {toast}
        </div>
      )}

      {/* ── Comments bottom sheet ── */}
      {showComments && (
        <CommentsDrawer
          clipId={clip.id}
          onClose={() => setShowComments(false)}
          onPosted={() => setCommentCount(c => c + 1)}
        />
      )}
    </div>
  )
}
