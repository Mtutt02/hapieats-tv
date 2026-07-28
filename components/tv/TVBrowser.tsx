'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { X, Volume2, VolumeX, Maximize2, Minimize2, ChevronUp, ChevronDown, PictureInPicture2, SkipForward } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface TVPlaylistItem {
  title: string
  muxPlaybackId: string
  duration: number | null
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
  const muxPlayer = container.querySelector('mux-player')
  if (muxPlayer?.shadowRoot) {
    const v = muxPlayer.shadowRoot.querySelector('video')
    if (v) return v as HTMLVideoElement
  }
  return null
}

// ─── On-Screen Display ────────────────────────────────────────────────────────
function OSD({
  channel,
  visible,
  playlistIndex,
  onSkip,
}: {
  channel: TVChannel
  visible: boolean
  playlistIndex: number
  onSkip?: () => void
}) {
  const currentItem = channel.playlist?.[playlistIndex]
  const hasNext = (channel.playlist?.length ?? 0) > 1

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 z-20 transition-all duration-500',
        'bg-gradient-to-t from-black/95 via-black/50 to-transparent px-5 sm:px-8 py-5',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none',
      )}
    >
      <div className="flex items-end justify-between gap-4">
        {/* Left: channel info */}
        <div className="flex items-end gap-4 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <span className="text-primary font-mono font-bold text-sm tracking-widest">
                CH {String(channel.number).padStart(2, '0')}
              </span>
              {channel.isLive && (
                <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm tracking-wider animate-pulse">
                  ● LIVE
                </span>
              )}
              <span className="text-white/40 text-xs uppercase tracking-wider">{channel.category}</span>
              {channel.playlist && channel.playlist.length > 1 && (
                <span className="text-white/30 text-xs font-mono">
                  {playlistIndex + 1} / {channel.playlist.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none">{channel.icon}</span>
              <div className="min-w-0">
                <p className="text-white font-bold text-lg leading-tight">{channel.name}</p>
                <p className="text-white/60 text-sm line-clamp-1 mt-0.5">
                  {currentItem?.title ?? channel.currentTitle}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: skip + branding */}
        <div className="flex items-end gap-3 flex-shrink-0">
          {hasNext && onSkip && (
            <button
              onClick={onSkip}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 rounded-lg px-3 py-1.5 text-white transition-all active:scale-95"
            >
              <SkipForward className="h-3.5 w-3.5" />
              <span className="text-xs font-bold tracking-wide">NEXT</span>
            </button>
          )}
          <div className="text-right">
            <p className="font-bold text-white/40 tracking-wider text-sm">HapiEats TV</p>
            <p className="font-mono text-xs text-white/25 mt-1">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Channel Guide — two-panel EPG ────────────────────────────────────────────
function ChannelGuide({
  channels,
  currentNumber,
  currentPlaylistIndex,
  onSelect,
  onSelectVideo,
  onClose,
}: {
  channels: TVChannel[]
  currentNumber: number
  currentPlaylistIndex: number
  onSelect: (ch: TVChannel) => void
  onSelectVideo: (ch: TVChannel, videoIndex: number) => void
  onClose: () => void
}) {
  const [focusedNumber, setFocusedNumber] = useState(currentNumber)
  const listRef = useRef<HTMLDivElement>(null)
  const focusedChannel = channels.find(c => c.number === focusedNumber) ?? channels[0]

  useEffect(() => {
    if (!listRef.current) return
    const active = listRef.current.querySelector<HTMLElement>('[data-active="true"]')
    if (active) setTimeout(() => active.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
  }, [])

  return (
    <div className="absolute inset-0 z-30 flex flex-col" style={{ background: 'rgba(5,5,5,0.97)' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/70 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.22em]">Channel Guide</span>
          <span className="text-[10px] text-zinc-600">· {channels.length} channels</span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white transition-colors p-1 rounded"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ── Left: channel list ── */}
        <div
          ref={listRef}
          className="w-40 sm:w-48 border-r border-zinc-800/60 overflow-y-auto flex-shrink-0"
          style={{ scrollbarWidth: 'none' }}
        >
          {channels.map(ch => {
            const isActive = ch.number === currentNumber
            const isFocused = ch.number === focusedNumber
            return (
              <button
                key={ch.number}
                data-active={isActive ? 'true' : undefined}
                onClick={() => { onSelect(ch); onClose() }}
                onMouseEnter={() => setFocusedNumber(ch.number)}
                onFocus={() => setFocusedNumber(ch.number)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors duration-100 border-l-2',
                  isFocused
                    ? 'bg-zinc-800/70 border-l-primary'
                    : isActive
                    ? 'bg-zinc-900/50 border-l-primary/40'
                    : 'border-l-transparent hover:bg-zinc-900/50',
                )}
              >
                <span className={cn(
                  'font-mono text-[9px] w-6 flex-shrink-0 font-bold',
                  isFocused ? 'text-primary' : isActive ? 'text-primary/60' : 'text-zinc-600',
                )}>
                  {String(ch.number).padStart(2, '0')}
                </span>
                <span className="text-sm leading-none flex-shrink-0">{ch.icon || '📺'}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    'text-[11px] font-bold truncate leading-tight',
                    isFocused ? 'text-white' : isActive ? 'text-primary' : 'text-zinc-300',
                  )}>
                    {ch.name}
                  </p>
                  {ch.isLive && (
                    <span className="text-[8px] bg-red-600 text-white px-1 py-px rounded font-bold animate-pulse">
                      LIVE
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* ── Right: channel detail + playlist ── */}
        <div
          className="flex-1 overflow-y-auto p-4 min-h-0"
          style={{ scrollbarWidth: 'none' }}
        >
          {focusedChannel && (
            <>
              {/* Channel header */}
              <div className="flex items-start gap-3 mb-5">
                <span className="text-5xl leading-none">{focusedChannel.icon || '📺'}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-mono text-[10px] text-zinc-500 font-bold">
                      CH {String(focusedChannel.number).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                      {focusedChannel.category}
                    </span>
                    {focusedChannel.isLive && (
                      <span className="bg-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded text-white animate-pulse">
                        LIVE
                      </span>
                    )}
                  </div>
                  <h3 className="text-white font-bold text-base leading-tight">{focusedChannel.name}</h3>
                  {focusedChannel.description && (
                    <p className="text-zinc-500 text-xs mt-1 leading-snug">{focusedChannel.description}</p>
                  )}
                </div>
              </div>

              {/* Playlist */}
              {focusedChannel.playlist && focusedChannel.playlist.length > 0 ? (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                      {focusedChannel.number === currentNumber ? 'Now Playing' : 'Playlist'}
                    </span>
                    <span className="text-[9px] text-zinc-600">
                      · {focusedChannel.playlist.length} video{focusedChannel.playlist.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {focusedChannel.playlist.map((item, i) => {
                      const isNowPlaying = focusedChannel.number === currentNumber && i === currentPlaylistIndex
                      const mins = item.duration != null ? Math.floor(item.duration / 60) : null
                      const secs = item.duration != null ? String(Math.floor(item.duration % 60)).padStart(2, '0') : null
                      return (
                        <button
                          key={i}
                          onClick={() => { onSelectVideo(focusedChannel, i); onClose() }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-left',
                            'active:scale-[0.98]',
                            isNowPlaying
                              ? 'bg-primary/15 border border-primary/25'
                              : 'bg-zinc-900/50 border border-zinc-800/30 hover:bg-zinc-800/60 hover:border-zinc-700/50',
                          )}
                        >
                          <span className={cn(
                            'font-mono text-[9px] w-5 text-center flex-shrink-0 font-bold',
                            isNowPlaying ? 'text-primary' : 'text-zinc-600',
                          )}>
                            {isNowPlaying ? '▶' : String(i + 1)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'text-xs font-medium truncate',
                              isNowPlaying ? 'text-primary' : 'text-zinc-300',
                            )}>
                              {item.title}
                            </p>
                          </div>
                          {mins !== null && (
                            <span className="text-[10px] text-zinc-600 flex-shrink-0 font-mono">
                              {mins}:{secs}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-zinc-600 text-xs">
                  {focusedChannel.isLive ? '🔴 Streaming live' : 'No playlist available'}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Physical Remote Control ──────────────────────────────────────────────────
interface RemoteProps {
  channels: TVChannel[]
  currentIndex: number
  currentChannel: TVChannel | undefined
  currentPlaylistIndex: number
  onChannelUp: () => void
  onChannelDown: () => void
  onChannelSelect: (n: number) => void
  onToggleGuide: () => void
  onToggleMute: () => void
  onToggleFullscreen: () => void
  onTogglePiP: () => void
  onShowOSD: () => void
  onMinimize: () => void
  onSkip: () => void
  muted: boolean
  showGuide: boolean
  isFullscreen: boolean
  isPiP: boolean
}

function PhysicalRemote({
  currentChannel,
  currentPlaylistIndex,
  onChannelUp,
  onChannelDown,
  onChannelSelect,
  onToggleGuide,
  onToggleMute,
  onToggleFullscreen,
  onTogglePiP,
  onShowOSD,
  onMinimize,
  onSkip,
  muted,
  showGuide,
  isFullscreen,
  isPiP,
}: RemoteProps) {
  const [numBuffer, setNumBuffer] = useState('')
  const numTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasPlaylist = (currentChannel?.playlist?.length ?? 0) > 1

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
    onClick, children, className = '', active = false, red = false, small = false, disabled = false,
  }: {
    onClick: () => void; children: React.ReactNode; className?: string
    active?: boolean; red?: boolean; small?: boolean; disabled?: boolean
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center font-bold select-none transition-all duration-75',
        'rounded-lg border active:scale-95',
        'shadow-[0_2px_0_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.05)]',
        'active:shadow-none active:translate-y-[1px]',
        small ? 'text-[10px]' : 'text-xs',
        disabled
          ? 'opacity-30 cursor-not-allowed bg-zinc-900 border-zinc-800 text-zinc-600'
          : red
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
      className="bg-[#0c0c0c] rounded-t-[28px] border border-zinc-800/80 border-b-0 relative"
      style={{ background: 'linear-gradient(175deg, #141414 0%, #080808 100%)' }}
    >
      {/* Minimize button */}
      <button
        onClick={onMinimize}
        className="absolute top-3 right-3 z-10 h-6 w-6 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-400 hover:text-white transition-colors"
        title="Minimize remote"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

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
                {hasPlaylist && (
                  <span className="ml-1 text-green-800">
                    · {currentPlaylistIndex + 1}/{currentChannel.playlist!.length}
                  </span>
                )}
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

        {/* Skip button — full width */}
        <Btn
          onClick={onSkip}
          disabled={!hasPlaylist}
          className="w-full h-8 gap-1.5"
          small
        >
          <SkipForward className="h-3 w-3" />
          SKIP TO NEXT VIDEO
        </Btn>

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
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center"
      style={{ width: 210 }}
    >
      {/* Remote body — collapses via max-height */}
      <div
        className={cn(
          'w-full overflow-hidden transition-all duration-300 ease-in-out',
          open ? 'max-h-[650px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <PhysicalRemote {...remoteProps} />
      </div>

      {/* Toggle handle — always visible */}
      <button
        onClick={onToggle}
        className={cn(
          'w-[175px] flex flex-col items-center gap-0.5 py-2 px-4',
          'rounded-t-2xl border border-b-0 border-zinc-800 transition-colors duration-150',
          open ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-800/80',
        )}
        style={{
          background: open
            ? 'linear-gradient(180deg, #161616 0%, #0e0e0e 100%)'
            : 'linear-gradient(180deg, #222 0%, #161616 100%)',
          boxShadow: '-6px 0 20px rgba(0,0,0,0.5), 6px 0 20px rgba(0,0,0,0.5)',
        }}
      >
        <div className="w-8 h-0.5 rounded-full bg-zinc-700" />
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] font-black tracking-[0.2em] text-zinc-500 uppercase">
            {open ? 'Hide' : 'Remote'}
          </span>
          <ChevronUp
            className={cn(
              'h-2.5 w-2.5 text-zinc-600 transition-transform duration-300',
              open && 'rotate-180',
            )}
          />
        </div>
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
  const [playlistIndex, setPlaylistIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const channel = channels[currentIndex]

  // ── OSD ──
  const showOSDTemporarily = useCallback(() => {
    setShowOSD(true)
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current)
    osdTimerRef.current = setTimeout(() => setShowOSD(false), 4500)
  }, [])

  // Reset playlist index when channel changes
  useEffect(() => {
    setPlaylistIndex(0)
    showOSDTemporarily()
    return () => { if (osdTimerRef.current) clearTimeout(osdTimerRef.current) }
  }, [currentIndex]) // eslint-disable-line

  // ── Playlist advance (skip or auto-advance) ──
  const advancePlaylist = useCallback(() => {
    const ch = channels[currentIndex]
    if (!ch?.playlist?.length) return
    const nextIdx = (playlistIndex + 1) % ch.playlist.length
    setTransitionNum(ch.number)
    setTransitioning(true)
    setTimeout(() => {
      setPlaylistIndex(nextIdx)
      setTransitioning(false)
      setTransitionNum(null)
    }, 200)
    showOSDTemporarily()
  }, [channels, currentIndex, playlistIndex, showOSDTemporarily])

  // ── Channel switching ──
  const switchChannel = useCallback((newIndex: number) => {
    const clamped = Math.max(0, Math.min(channels.length - 1, newIndex))
    setTransitioning(true)
    setTransitionNum(channels[clamped]?.number ?? null)
    setTimeout(() => {
      setCurrentIndex(clamped)
      setTransitioning(false)
      setTransitionNum(null)
    }, 300)
  }, [channels])

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

  const selectChannelAndVideo = useCallback((ch: TVChannel, videoIndex: number) => {
    const idx = channels.findIndex(c => c.number === ch.number)
    if (idx === -1) return
    if (idx === currentIndex) {
      // Same channel — just jump to the video with a brief flash
      setTransitioning(true)
      setTransitionNum(ch.number)
      setTimeout(() => {
        setPlaylistIndex(videoIndex)
        setTransitioning(false)
        setTransitionNum(null)
        showOSDTemporarily()
      }, 200)
    } else {
      // Different channel — switch channel then set video index
      setTransitioning(true)
      setTransitionNum(ch.number)
      setTimeout(() => {
        setCurrentIndex(idx)
        setPlaylistIndex(videoIndex)
        setTransitioning(false)
        setTransitionNum(null)
        showOSDTemporarily()
      }, 300)
    }
  }, [channels, currentIndex, showOSDTemporarily])

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
  const pipVideoRef = useRef<HTMLVideoElement | null>(null)

  const setPipVideoRef = useCallback((el: HTMLVideoElement | null) => {
    pipVideoRef.current = el
  }, [])

  const togglePiP = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
        return
      }
      let video = pipVideoRef.current
      if (!video && containerRef.current) {
        video = findVideoElement(containerRef.current)
      }
      if (!video) {
        const muxPlayer = containerRef.current?.querySelector('mux-player') as HTMLElement & { requestPictureInPicture?: () => Promise<void> }
        if (muxPlayer?.requestPictureInPicture) {
          await muxPlayer.requestPictureInPicture()
          return
        }
      }
      if (video) {
        await video.requestPictureInPicture()
      }
    } catch (err) {
      console.warn('PiP not available:', err)
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
      else if (e.key === 'n' || e.key === 'N') advancePlaylist()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [channelUp, channelDown, toggleFullscreen, togglePiP, advancePlaylist])

  const remoteProps: RemoteProps = {
    channels,
    currentIndex,
    currentChannel: channel,
    currentPlaylistIndex: playlistIndex,
    onChannelUp: channelUp,
    onChannelDown: channelDown,
    onChannelSelect: selectChannelByNumber,
    onToggleGuide: () => setShowGuide(v => !v),
    onToggleMute: () => setMuted(v => !v),
    onToggleFullscreen: toggleFullscreen,
    onTogglePiP: togglePiP,
    onShowOSD: showOSDTemporarily,
    onMinimize: () => setRemoteOpen(false),
    onSkip: advancePlaylist,
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
      {/* ── TV SCREEN ── */}
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
            {(() => {
              const playlistItem = channel?.playlist?.[playlistIndex]
              const playbackId = playlistItem?.muxPlaybackId ?? channel?.muxPlaybackId
              const videoSrc = channel?.videoUrl

              if (videoSrc) {
                return (
                  <video
                    key={videoSrc}
                    ref={(el) => { if (el) setPipVideoRef(el) }}
                    src={videoSrc}
                    autoPlay muted={muted} loop playsInline
                    className="w-full h-full object-cover"
                  />
                )
              }

              if (playbackId) {
                return (
                  <MuxPlayerWrapper
                    key={`${channel?.number}-${playlistIndex}`}
                    playbackId={playbackId}
                    muted={muted}
                    isLive={channel?.isLive}
                    onVideoReady={setPipVideoRef}
                    onEnded={playlistItem ? advancePlaylist : undefined}
                  />
                )
              }

              return (
                <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center gap-4">
                  <span className="text-7xl">{channel?.icon}</span>
                  <p className="text-white font-bold text-2xl">{channel?.name}</p>
                  <p className="text-zinc-500 text-sm">{channel?.description}</p>
                  <p className="text-zinc-600 text-xs mt-2">No video content available</p>
                </div>
              )
            })()}
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
              playlistIndex={playlistIndex}
              onSkip={advancePlaylist}
            />
          )}

          {/* PiP badge */}
          {isPiP && (
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/70 rounded-lg px-2.5 py-1.5 backdrop-blur-sm pointer-events-none">
              <PictureInPicture2 className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-bold text-primary tracking-wider">PiP ACTIVE</span>
            </div>
          )}

          {/* Channel guide */}
          {showGuide && channel && (
            <ChannelGuide
              channels={channels}
              currentNumber={channel.number}
              currentPlaylistIndex={playlistIndex}
              onSelect={selectChannel}
              onSelectVideo={selectChannelAndVideo}
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
    </div>
  )
}

// ─── Lazy Mux wrapper ─────────────────────────────────────────────────────────
function MuxPlayerWrapper({ playbackId, muted, isLive, onVideoReady, onEnded }: {
  playbackId: string
  muted: boolean
  isLive?: boolean
  onVideoReady?: (el: HTMLVideoElement | null) => void
  onEnded?: () => void
}) {
  const playerRef = useRef<HTMLElement | null>(null)
  const [MuxPlayer, setMuxPlayer] = useState<React.ComponentType<
    Record<string, unknown> & { onEnded?: () => void }
  > | null>(null)

  useEffect(() => {
    import('@mux/mux-player-react').then(m => setMuxPlayer(() => m.default))
  }, [])

  useEffect(() => {
    if (!playerRef.current || !onVideoReady) return
    const el = playerRef.current
    const check = () => {
      const video = el.shadowRoot?.querySelector('video')
      if (video) {
        onVideoReady(video as HTMLVideoElement)
        return true
      }
      return false
    }
    if (!check()) {
      const interval = setInterval(() => {
        if (check()) clearInterval(interval)
      }, 200)
      setTimeout(() => clearInterval(interval), 5000)
    }
    return () => onVideoReady(null)
  }, [MuxPlayer]) // eslint-disable-line

  if (!MuxPlayer) return null
  return (
    <MuxPlayer
      ref={playerRef}
      playbackId={playbackId}
      muted={muted}
      autoPlay
      loop={!isLive}
      streamType={isLive ? 'live' : 'on-demand'}
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
