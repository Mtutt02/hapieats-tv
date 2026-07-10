'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { X, Volume2, VolumeX, Maximize2, Minimize2, ChevronDown, Gamepad2, PictureInPicture2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface TVPlaylistItem {
  title: string
  muxPlaybackId: string
  duration: number | null // seconds; null → FALLBACK_DURATION
}

export interface TVChannel {
  number: number
  name: string
  icon: string
  description: string
  videoUrl?: string
  muxPlaybackId?: string
  isLive?: boolean
  currentTitle: string
  category: string
  playlist?: TVPlaylistItem[]
}

interface Props {
  channels: TVChannel[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function findVideoElement(container: HTMLElement): HTMLVideoElement | null {
  const direct = container.querySelector('video')
  if (direct) return direct as HTMLVideoElement
  // Try Mux Player shadow DOM
  const muxPlayer = container.querySelector('mux-player')
  if (muxPlayer?.shadowRoot) {
    const v = muxPlayer.shadowRoot.querySelector('video')
    if (v) return v as HTMLVideoElement
  }
  return null
}

// ─── "Live broadcast" scheduling ──────────────────────────────────────────────
// Playback position is deterministic: totalDuration = sum of video durations,
// offset = wall-clock seconds modulo totalDuration, then walk the playlist to
// find the current video + seek position. Everyone tuning in at the same
// moment sees the same "broadcast"; returning later shows different content.
const FALLBACK_DURATION = 300 // seconds, used when a video has no duration

function itemDuration(item: TVPlaylistItem): number {
  return item.duration && item.duration > 0 ? item.duration : FALLBACK_DURATION
}

function computeSchedule(playlist: TVPlaylistItem[]): { index: number; offset: number } {
  if (!playlist.length) return { index: 0, offset: 0 }
  const total = playlist.reduce((sum, it) => sum + itemDuration(it), 0)
  let t = (Date.now() / 1000) % total
  for (let i = 0; i < playlist.length; i++) {
    const d = itemDuration(playlist[i])
    if (t < d) return { index: i, offset: Math.floor(t) }
    t -= d
  }
  return { index: 0, offset: 0 }
}

// NOW / NEXT titles for a channel per the deterministic schedule (used by the
// EPG guide; the tuned channel's OSD uses actual playback state instead).
function channelNowNext(ch: TVChannel): { now: string; next?: string } {
  if (ch.playlist && ch.playlist.length > 0) {
    const { index } = computeSchedule(ch.playlist)
    return {
      now: ch.playlist[index].title,
      next: ch.playlist.length > 1 ? ch.playlist[(index + 1) % ch.playlist.length].title : undefined,
    }
  }
  return { now: ch.currentTitle }
}

// ─── On-Screen Display ────────────────────────────────────────────────────────
function OSD({ channel, visible, nowTitle, nextTitle }: {
  channel: TVChannel
  visible: boolean
  nowTitle?: string
  nextTitle?: string
}) {
  return (
    <div className={cn(
      'absolute bottom-0 left-0 right-0 z-20 transition-all duration-500 pointer-events-none',
      'bg-gradient-to-t from-black/95 via-black/50 to-transparent px-5 sm:px-8 py-5',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3',
    )}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-end gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-primary font-mono font-bold text-sm tracking-widest">
                CH {String(channel.number).padStart(2, '0')}
              </span>
              {channel.isLive && (
                <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm tracking-wider animate-pulse">
                  ● LIVE
                </span>
              )}
              <span className="text-white/40 text-xs uppercase tracking-wider">{channel.category}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none">{channel.icon}</span>
              <div>
                <p className="text-white font-bold text-lg leading-tight">{channel.name}</p>
                <p className="text-white/60 text-sm line-clamp-1 mt-0.5">{nowTitle ?? channel.currentTitle}</p>
                {nextTitle && (
                  <p className="text-white/35 text-xs line-clamp-1 mt-0.5">Up next: {nextTitle}</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-white/40 tracking-wider text-sm">HapiEats TV</p>
          <p className="font-mono text-xs text-white/25 mt-1">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Channel Guide (horizontal EPG strip inside TV screen) ────────────────────
function ChannelGuide({
  channels,
  currentNumber,
  onSelect,
  onClose,
}: {
  channels: TVChannel[]
  currentNumber: number
  onSelect: (ch: TVChannel) => void
  onClose: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scrollRef.current) return
    const active = scrollRef.current.querySelector<HTMLElement>('[data-active="true"]')
    if (active) {
      setTimeout(() => active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }), 80)
    }
  }, [])

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black via-black/97 to-black/0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Channel Guide</span>
          <span className="text-[10px] text-zinc-600">— {channels.length} channels</span>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1 rounded">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Horizontal scrolling channel strip */}
      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto px-4 pb-5 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {channels.map(ch => {
          const isActive = ch.number === currentNumber
          const { now, next } = channelNowNext(ch)
          return (
            <button
              key={ch.number}
              data-active={isActive ? 'true' : undefined}
              onClick={() => { onSelect(ch); onClose() }}
              className={cn(
                'flex-shrink-0 snap-start w-44 rounded-xl p-3 border text-left',
                'transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]',
                isActive
                  ? 'border-primary bg-primary/20 ring-1 ring-primary/40'
                  : 'border-zinc-800 bg-zinc-900/90 hover:border-zinc-600 hover:bg-zinc-800/90',
              )}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className={cn('font-mono text-[10px] font-bold', isActive ? 'text-primary' : 'text-zinc-500')}>
                  CH {String(ch.number).padStart(2, '0')}
                </span>
                {ch.isLive && (
                  <span className="bg-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded text-white animate-pulse">
                    LIVE
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-2xl leading-none">{ch.icon}</span>
                <span className={cn('text-sm font-bold truncate leading-tight', isActive ? 'text-primary' : 'text-white')}>
                  {ch.name}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 line-clamp-1 leading-snug">
                <span className={cn('font-bold', isActive ? 'text-primary/80' : 'text-zinc-400')}>NOW </span>
                {now}
              </p>
              {next && (
                <p className="text-[11px] text-zinc-600 line-clamp-1 leading-snug mt-0.5">
                  <span className="font-bold text-zinc-500">NEXT </span>
                  {next}
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Physical Remote Control ──────────────────────────────────────────────────
interface RemoteProps {
  channels: TVChannel[]
  currentIndex: number
  currentChannel: TVChannel | undefined
  onChannelUp: () => void
  onChannelDown: () => void
  onChannelSelect: (n: number) => void
  onToggleGuide: () => void
  onToggleMute: () => void
  onToggleFullscreen: () => void
  onTogglePiP: () => void
  onShowOSD: () => void
  muted: boolean
  showGuide: boolean
  isFullscreen: boolean
  isPiP: boolean
}

function PhysicalRemote({
  currentChannel,
  onChannelUp,
  onChannelDown,
  onChannelSelect,
  onToggleGuide,
  onToggleMute,
  onToggleFullscreen,
  onTogglePiP,
  onShowOSD,
  muted,
  showGuide,
  isFullscreen,
  isPiP,
}: RemoteProps) {
  const [numBuffer, setNumBuffer] = useState('')
  const numTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pressNumber = useCallback((n: string) => {
    const next = (numBuffer + n).slice(-2)
    setNumBuffer(next)
    if (numTimerRef.current) clearTimeout(numTimerRef.current)
    numTimerRef.current = setTimeout(() => {
      const num = parseInt(next, 10)
      if (!isNaN(num)) onChannelSelect(num)
      setNumBuffer('')
    }, 1200)
  }, [numBuffer, onChannelSelect])

  useEffect(() => () => { if (numTimerRef.current) clearTimeout(numTimerRef.current) }, [])

  const Btn = ({
    onClick, children, className = '', active = false, red = false, small = false,
  }: {
    onClick: () => void; children: React.ReactNode; className?: string
    active?: boolean; red?: boolean; small?: boolean
  }) => (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-center font-bold select-none transition-all duration-75',
        'rounded-lg border active:scale-95',
        'shadow-[0_2px_0_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.05)]',
        'active:shadow-none active:translate-y-[1px]',
        small ? 'text-[10px]' : 'text-xs',
        red
          ? 'bg-red-800 hover:bg-red-700 border-red-900 text-red-200'
          : active
            ? 'bg-primary/20 border-primary/50 text-primary'
            : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700/80 text-zinc-200',
        className,
      )}
    >
      {children}
    </button>
  )

  const NumBtn = ({ n }: { n: string }) => (
    <Btn onClick={() => pressNumber(n)} className="h-9 text-sm font-black">{n}</Btn>
  )

  return (
    <div
      className="bg-[#0c0c0c] rounded-[28px] border border-zinc-800/80"
      style={{ background: 'linear-gradient(175deg, #141414 0%, #080808 100%)' }}
    >
      {/* Grip handle */}
      <div className="flex justify-center pt-2.5 pb-1">
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-0.5 h-2.5 rounded-full bg-zinc-700/40" />
          ))}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-2.5">
        {/* Brand + LED */}
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black tracking-[0.25em] text-zinc-600 uppercase">HapiEats TV</span>
          <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,1)]" />
        </div>

        {/* Green channel display */}
        <div
          className="rounded-lg px-3 py-2 text-center border border-zinc-900"
          style={{ background: 'linear-gradient(135deg, #091209 0%, #040804 100%)' }}
        >
          {numBuffer ? (
            <>
              <div className="font-mono text-[9px] text-green-700/70 tracking-widest">TUNE TO</div>
              <div className="font-mono text-xl font-black text-green-400 tracking-[0.15em]">
                {numBuffer}<span className="animate-pulse">_</span>
              </div>
            </>
          ) : currentChannel ? (
            <>
              <div className="font-mono text-[9px] text-green-700/60 tracking-widest">
                CH {String(currentChannel.number).padStart(2, '0')}
              </div>
              <div className="font-mono text-sm font-bold text-green-400/90 truncate mt-0.5">
                {currentChannel.name}
              </div>
            </>
          ) : (
            <div className="font-mono text-xs text-green-700/40">NO SIGNAL</div>
          )}
        </div>

        {/* Function row: MUTE · GUIDE · PiP */}
        <div className="grid grid-cols-3 gap-1.5">
          <Btn onClick={onToggleMute} active={muted} className="h-8 gap-1" small>
            {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
            MUTE
          </Btn>
          <Btn onClick={onToggleGuide} active={showGuide} className="h-8" small>
            ☰ GUIDE
          </Btn>
          <Btn onClick={onTogglePiP} active={isPiP} className="h-8 gap-0.5" small>
            <PictureInPicture2 className="h-3 w-3" /> PiP
          </Btn>
        </div>

        {/* D-Pad */}
        <div className="flex items-center justify-center py-1">
          <div className="relative" style={{ width: 110, height: 110 }}>
            {/* D-pad base circle */}
            <div
              className="absolute inset-0 rounded-full border border-zinc-700/40"
              style={{ background: 'radial-gradient(ellipse at 40% 35%, #1e1e1e 0%, #0d0d0d 100%)' }}
            />

            {/* CH ▲ */}
            <button
              onClick={onChannelUp}
              className="absolute top-1 left-1/2 -translate-x-1/2 h-9 w-9 flex flex-col items-center justify-center gap-px text-zinc-400 hover:text-white active:text-primary transition-colors select-none"
            >
              <span className="text-[11px] font-black">▲</span>
              <span className="text-[7px] text-zinc-600 tracking-tight font-bold">CH</span>
            </button>

            {/* CH ▼ */}
            <button
              onClick={onChannelDown}
              className="absolute bottom-1 left-1/2 -translate-x-1/2 h-9 w-9 flex flex-col items-center justify-center gap-px text-zinc-400 hover:text-white active:text-primary transition-colors select-none"
            >
              <span className="text-[7px] text-zinc-600 tracking-tight font-bold">CH</span>
              <span className="text-[11px] font-black">▼</span>
            </button>

            {/* VOL − */}
            <button
              onClick={() => {/* vol down placeholder */}}
              className="absolute left-1 top-1/2 -translate-y-1/2 h-9 w-9 flex flex-col items-center justify-center gap-px text-zinc-400 hover:text-white transition-colors select-none"
            >
              <span className="text-[7px] text-zinc-600 tracking-tight font-bold">VOL</span>
              <span className="text-[11px] font-black">−</span>
            </button>

            {/* VOL + */}
            <button
              onClick={() => {/* vol up placeholder */}}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex flex-col items-center justify-center gap-px text-zinc-400 hover:text-white transition-colors select-none"
            >
              <span className="text-[7px] text-zinc-600 tracking-tight font-bold">VOL</span>
              <span className="text-[11px] font-black">+</span>
            </button>

            {/* OK center */}
            <button
              onClick={onShowOSD}
              className="absolute inset-0 m-auto h-10 w-10 rounded-full z-10 flex items-center justify-center text-[10px] font-black text-zinc-400 hover:text-white transition-colors select-none border border-zinc-700/50"
              style={{ background: 'radial-gradient(ellipse at 40% 35%, #2a2a2a, #121212)' }}
            >
              OK
            </button>
          </div>
        </div>

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-1.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
            <NumBtn key={n} n={n} />
          ))}
          <div />
          <NumBtn n="0" />
          <div />
        </div>

        {/* Full screen button */}
        <Btn onClick={onToggleFullscreen} className="w-full h-9 gap-1.5" small>
          {isFullscreen
            ? <><Minimize2 className="h-3 w-3" />EXIT FULLSCREEN</>
            : <><Maximize2 className="h-3 w-3" />FULL SCREEN</>
          }
        </Btn>
      </div>
    </div>
  )
}

// ─── Floating Remote Shell ────────────────────────────────────────────────────
function FloatingRemote(props: RemoteProps & { open: boolean; onToggle: () => void }) {
  const { open, onToggle, ...remoteProps } = props
  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col items-end',
        // Anchor bottom-right; stay above the mobile bottom nav on small screens
        'right-4 bottom-[calc(64px+env(safe-area-inset-bottom))]',
        'md:bottom-[calc(1rem+env(safe-area-inset-bottom))]',
        'w-[210px] max-w-[calc(100vw-2rem)]',
      )}
    >
      {/* Remote body — collapses via max-height/opacity */}
      <div
        className={cn(
          'w-full overflow-hidden rounded-[28px] transition-all duration-300 ease-in-out',
          'shadow-[0_12px_40px_rgba(0,0,0,0.6)]',
          open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none',
        )}
      >
        <PhysicalRemote {...remoteProps} />
      </div>

      {/* Corner pill — expands/collapses the remote (R key also toggles) */}
      <button
        onClick={onToggle}
        aria-label={open ? 'Hide remote' : 'Show remote'}
        className={cn(
          'flex items-center justify-center rounded-full select-none',
          'bg-zinc-900 border border-zinc-700/80 text-zinc-300',
          'shadow-[0_4px_16px_rgba(0,0,0,0.5)]',
          'transition-all duration-300 ease-in-out',
          'hover:text-emerald-400 hover:ring-2 hover:ring-emerald-500/60',
          open ? 'h-9 w-9 mt-2' : 'h-12 w-12',
        )}
      >
        {open
          ? <ChevronDown className="h-4 w-4" />
          : <Gamepad2 className="h-5 w-5" />
        }
      </button>
    </div>
  )
}

// ─── Main TV Browser ───────────────────────────────────────────────────────────
export default function TVBrowser({ channels }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const [showGuide, setShowGuide] = useState(false)
  const [showOSD, setShowOSD] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPiP, setIsPiP] = useState(false)
  const [remoteOpen, setRemoteOpen] = useState(true)
  const [transitioning, setTransitioning] = useState(false)
  const [transitionNum, setTransitionNum] = useState<number | null>(null)
  // Playlist playback state — index into current channel's playlist + seek
  // offset. Only recomputed on channel tune-in (never mid-session) to avoid
  // playback jumps.
  const [playback, setPlayback] = useState<{ index: number; offset: number }>({ index: 0, offset: 0 })
  const [showIntro, setShowIntro] = useState(false)

  // First-visit intro — explains how the TV works
  useEffect(() => {
    try {
      if (!localStorage.getItem('he-tv-intro-seen')) setShowIntro(true)
    } catch { /* storage unavailable */ }
  }, [])

  const dismissIntro = () => {
    setShowIntro(false)
    try { localStorage.setItem('he-tv-intro-seen', '1') } catch { /* ignore */ }
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const channel = channels[currentIndex]
  const playlist = channel?.playlist
  const nowItem = playlist && playlist.length > 0 ? playlist[playback.index % playlist.length] : null
  const nextItem = playlist && playlist.length > 1 ? playlist[(playback.index + 1) % playlist.length] : null

  // Initial tune-in: compute the broadcast schedule once on mount (client-only
  // so SSR and hydration render the same frame)
  useEffect(() => {
    const pl = channels[0]?.playlist
    if (pl && pl.length > 0) setPlayback(computeSchedule(pl))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── OSD ──
  const showOSDTemporarily = useCallback(() => {
    setShowOSD(true)
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current)
    osdTimerRef.current = setTimeout(() => setShowOSD(false), 4500)
  }, [])

  useEffect(() => {
    showOSDTemporarily()
    return () => { if (osdTimerRef.current) clearTimeout(osdTimerRef.current) }
  }, [currentIndex]) // eslint-disable-line

  // ── Channel switching ──
  const switchChannel = useCallback((newIndex: number) => {
    const clamped = Math.max(0, Math.min(channels.length - 1, newIndex))
    if (clamped === currentIndex) return // already tuned — don't recompute schedule
    setTransitioning(true)
    setTransitionNum(channels[clamped]?.number ?? null)
    setTimeout(() => {
      // Tune-in: land on the deterministic "live broadcast" position
      const pl = channels[clamped]?.playlist
      setPlayback(pl && pl.length > 0 ? computeSchedule(pl) : { index: 0, offset: 0 })
      setCurrentIndex(clamped)
      setTransitioning(false)
      setTransitionNum(null)
    }, 300)
  }, [channels, currentIndex])

  // ── Playlist auto-advance (video ended → next item, loop at end) ──
  const advancePlaylist = useCallback(() => {
    const pl = channels[currentIndex]?.playlist
    if (!pl || pl.length === 0) return
    setPlayback(p => ({ index: (p.index + 1) % pl.length, offset: 0 }))
  }, [channels, currentIndex])

  const channelUp = useCallback(() => switchChannel((currentIndex + 1) % channels.length), [currentIndex, channels.length, switchChannel])
  const channelDown = useCallback(() => switchChannel((currentIndex - 1 + channels.length) % channels.length), [currentIndex, channels.length, switchChannel])

  const selectChannelByNumber = useCallback((num: number) => {
    const idx = channels.findIndex(c => c.number === num)
    if (idx !== -1) switchChannel(idx)
  }, [channels, switchChannel])

  const selectChannel = useCallback((ch: TVChannel) => {
    const idx = channels.findIndex(c => c.number === ch.number)
    if (idx !== -1) switchChannel(idx)
  }, [channels, switchChannel])

  // ── Fullscreen ──
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }, [])

  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFSChange)
    return () => document.removeEventListener('fullscreenchange', onFSChange)
  }, [])

  // ── Picture-in-Picture ──
  const togglePiP = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else if (containerRef.current) {
        const video = findVideoElement(containerRef.current)
        if (video) await video.requestPictureInPicture()
      }
    } catch {
      // PiP not available
    }
  }, [])

  useEffect(() => {
    const onEnter = () => setIsPiP(true)
    const onLeave = () => setIsPiP(false)
    document.addEventListener('enterpictureinpicture', onEnter)
    document.addEventListener('leavepictureinpicture', onLeave)
    return () => {
      document.removeEventListener('enterpictureinpicture', onEnter)
      document.removeEventListener('leavepictureinpicture', onLeave)
    }
  }, [])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') channelUp()
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') channelDown()
      else if (e.key === 'm' || e.key === 'M') setMuted(v => !v)
      else if (e.key === 'g' || e.key === 'G') setShowGuide(v => !v)
      else if (e.key === 'Escape') setShowGuide(false)
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      else if (e.key === 'p' || e.key === 'P') togglePiP()
      else if (e.key === 'r' || e.key === 'R') setRemoteOpen(v => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [channelUp, channelDown, toggleFullscreen, togglePiP])

  const remoteProps: RemoteProps = {
    channels,
    currentIndex,
    currentChannel: channel,
    onChannelUp: channelUp,
    onChannelDown: channelDown,
    onChannelSelect: selectChannelByNumber,
    onToggleGuide: () => setShowGuide(v => !v),
    onToggleMute: () => setMuted(v => !v),
    onToggleFullscreen: toggleFullscreen,
    onTogglePiP: togglePiP,
    onShowOSD: showOSDTemporarily,
    muted,
    showGuide,
    isFullscreen,
    isPiP,
  }

  return (
    <div className={cn(
      'relative bg-zinc-950',
      isFullscreen ? 'h-screen' : 'h-[calc(100svh-56px)]',
    )}>
      {/* ── TV SCREEN — fills the whole space ── */}
      <div className="absolute inset-0 p-3 sm:p-4 pb-[46px] flex flex-col">
        {/* Outer bezel */}
        <div
          ref={containerRef}
          className={cn(
            'relative flex-1 rounded-2xl overflow-hidden min-h-0',
            'shadow-[0_0_0_5px_#18181b,0_0_0_7px_#27272a,0_24px_80px_rgba(0,0,0,0.9)]',
            'bg-black',
            isFullscreen && 'rounded-none shadow-none',
          )}
          onClick={() => { if (!showGuide) showOSDTemporarily() }}
        >
          {/* Scanlines */}
          <div
            className="absolute inset-0 z-[1] pointer-events-none opacity-[0.02]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,1) 2px,rgba(255,255,255,1) 4px)',
            }}
          />

          {/* Vignette */}
          <div
            className="absolute inset-0 z-[1] pointer-events-none"
            style={{ boxShadow: 'inset 0 0 140px rgba(0,0,0,0.6)' }}
          />

          {/* Video content */}
          <div className={cn('absolute inset-0 transition-opacity duration-300', transitioning ? 'opacity-0' : 'opacity-100')}>
            {nowItem && playlist ? (
              <MuxPlayerWrapper
                key={`${channel?.number}-${playback.index % playlist.length}`}
                playbackId={nowItem.muxPlaybackId}
                muted={muted}
                startTime={playback.offset}
                onEnded={advancePlaylist}
              />
            ) : channel?.videoUrl ? (
              <video
                key={channel.videoUrl}
                src={channel.videoUrl}
                autoPlay muted={muted} loop playsInline
                className="w-full h-full object-cover"
              />
            ) : channel?.muxPlaybackId ? (
              <MuxPlayerWrapper playbackId={channel.muxPlaybackId} muted={muted} isLive={channel.isLive} />
            ) : (
              <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
                <span className="text-7xl">{channel?.icon}</span>
                <p className="text-white font-bold text-2xl">{channel?.name}</p>
                <p className="text-zinc-500 text-sm">{channel?.description}</p>
                <p className="text-zinc-600 text-xs font-mono tracking-wide">
                  No programming yet — be the first to post to {channel?.name}
                </p>
              </div>
            )}
          </div>

          {/* Channel switch flash */}
          {transitioning && (
            <div className="absolute inset-0 z-10 bg-black flex items-center justify-center">
              <div className="text-white/15 text-8xl font-mono font-black tracking-widest">
                {transitionNum !== null ? String(transitionNum).padStart(2, '0') : '--'}
              </div>
            </div>
          )}

          {/* OSD */}
          {channel && (
            <OSD
              channel={channel}
              visible={showOSD && !showGuide && !transitioning}
              nowTitle={nowItem?.title}
              nextTitle={nextItem?.title}
            />
          )}

          {/* PiP badge */}
          {isPiP && (
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/70 rounded-lg px-2.5 py-1.5 backdrop-blur-sm pointer-events-none">
              <PictureInPicture2 className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-bold text-primary tracking-wider">PiP ACTIVE</span>
            </div>
          )}

          {/* Channel guide (slides up from bottom of TV) */}
          {showGuide && channel && (
            <ChannelGuide
              channels={channels}
              currentNumber={channel.number}
              onSelect={selectChannel}
              onClose={() => setShowGuide(false)}
            />
          )}

          {/* Corner branding */}
          {!showOSD && !showGuide && (
            <div className="absolute top-3 right-4 z-10 pointer-events-none">
              <span className="text-[10px] text-white/10 font-bold tracking-[0.2em] uppercase">HapiEats TV</span>
            </div>
          )}
        </div>

        {/* TV stand */}
        <div className="flex justify-center">
          <div className="w-16 h-1 bg-zinc-800 rounded-b-sm" />
        </div>
      </div>

      {/* ── FLOATING REMOTE ── */}
      {!isFullscreen && (
        <FloatingRemote
          {...remoteProps}
          open={remoteOpen}
          onToggle={() => setRemoteOpen(v => !v)}
        />
      )}

      {/* ── FIRST-VISIT INTRO ── */}
      {showIntro && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-label="How HapiEats TV works"
          onClick={dismissIntro}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-950 p-6 text-center shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 text-3xl" aria-hidden>
              📺
            </div>
            <h2 className="text-lg font-black tracking-tight text-white">Welcome to HapiEats TV</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Every channel is a station broadcasting <b className="text-zinc-200">nonstop</b> —
              tune in and the show is already on, just like real TV. Videos play back-to-back
              continuously, so there&apos;s nothing to pick and nothing to queue.
            </p>
            <div className="mt-4 space-y-1.5 text-left text-xs text-zinc-400">
              <p><b className="text-zinc-200">Flip channels</b> — remote, ↑/↓ arrow keys, or type a channel number</p>
              <p><b className="text-zinc-200">See what&apos;s on</b> — press G for the channel guide</p>
              <p><b className="text-zinc-200">Sit back</b> — when one video ends, the next starts automatically</p>
            </div>
            <button
              onClick={dismissIntro}
              className="mt-5 w-full rounded-xl bg-white py-2.5 text-sm font-bold text-black transition hover:bg-zinc-200"
            >
              Set the channel and enjoy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Lazy Mux wrapper ─────────────────────────────────────────────────────────
function MuxPlayerWrapper({ playbackId, muted, isLive, startTime, onEnded }: {
  playbackId: string
  muted: boolean
  isLive?: boolean
  startTime?: number
  onEnded?: () => void
}) {
  const [MuxPlayer, setMuxPlayer] = useState<React.ComponentType<Record<string, unknown>> | null>(null)
  useEffect(() => {
    import('@mux/mux-player-react').then(m => setMuxPlayer(() => m.default))
  }, [])
  if (!MuxPlayer) return null
  return (
    <MuxPlayer
      playbackId={playbackId}
      muted={muted}
      autoPlay
      loop={onEnded ? false : !isLive}
      streamType={isLive ? 'live' : 'on-demand'}
      startTime={startTime && startTime > 0 ? startTime : undefined}
      onEnded={onEnded}
      style={{
        '--controls': 'none',
        '--media-object-fit': 'cover',
        width: '100%',
        height: '100%',
      } as React.CSSProperties}
    />
  )
}
