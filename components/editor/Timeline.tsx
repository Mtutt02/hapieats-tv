'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TimelineTrack } from './types'

interface TimelineProps {
  tracks: TimelineTrack[]
  duration: number
  currentTime: number
  onSeek: (time: number) => void
  onDeleteClip: (trackId: string, clipId: string) => void
  zoom: number // 1-5
  onZoomChange: (zoom: number) => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Timeline({
  tracks,
  duration,
  currentTime,
  onSeek,
  onDeleteClip,
  zoom,
  onZoomChange,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [selectedClip, setSelectedClip] = useState<{ trackId: string; clipId: string } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [scrollLeft, setScrollLeft] = useState(0)

  const TRACK_HEIGHT = 44
  const PIXELS_PER_SECOND = 8 * zoom // zoom 1 = 8px/s, zoom 5 = 40px/s
  const totalWidth = Math.max(duration * PIXELS_PER_SECOND, 800)

  const getTimeFromX = useCallback((clientX: number): number => {
    if (!timelineRef.current) return 0
    const rect = timelineRef.current.getBoundingClientRect()
    const x = clientX - rect.left + timelineRef.current.scrollLeft
    return Math.max(0, Math.min(duration, x / PIXELS_PER_SECOND))
  }, [duration, PIXELS_PER_SECOND])

  // Handle playhead dragging on the ruler
  const handleRulerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const t = getTimeFromX(e.clientX)
    onSeek(t)
    setIsDragging(true)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMove = (e: MouseEvent) => {
      const t = getTimeFromX(e.clientX)
      onSeek(t)
    }

    const handleUp = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [isDragging, getTimeFromX, onSeek])

  // Auto-scroll when playhead moves beyond visible area
  useEffect(() => {
    if (!timelineRef.current) return
    const playheadX = currentTime * PIXELS_PER_SECOND
    const scrollLeft = timelineRef.current.scrollLeft
    const visibleWidth = timelineRef.current.clientWidth

    if (playheadX < scrollLeft + 50) {
      timelineRef.current.scrollLeft = Math.max(0, playheadX - 50)
    } else if (playheadX > scrollLeft + visibleWidth - 50) {
      timelineRef.current.scrollLeft = playheadX - visibleWidth + 50
    }
  }, [currentTime, PIXELS_PER_SECOND])

  const playheadX = currentTime * PIXELS_PER_SECOND

  // Generate time markers for the ruler
  const timeMarkers: number[] = []
  const markerInterval = zoom <= 2 ? 5 : zoom <= 4 ? 2 : 1
  for (let t = 0; t <= duration; t += markerInterval) {
    timeMarkers.push(t)
  }

  return (
    <div className="space-y-1">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
          Timeline
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-zinc-600 font-mono">{formatTime(currentTime)}</span>
          <div className="w-px h-3 bg-zinc-800 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onZoomChange(Math.max(1, zoom - 1))}
            disabled={zoom <= 1}
          >
            <ZoomOut className="h-3 w-3" />
          </Button>
          <span className="text-[10px] text-zinc-600 w-4 text-center">{zoom}x</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onZoomChange(Math.min(5, zoom + 1))}
            disabled={zoom >= 5}
          >
            <ZoomIn className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Timeline area */}
      <div
        ref={timelineRef}
        className="relative overflow-x-auto overflow-y-hidden rounded-xl border border-zinc-800 bg-zinc-950 select-none"
        style={{ maxHeight: tracks.length * TRACK_HEIGHT + 24 + 'px' }}
      >
        <div style={{ width: totalWidth + 'px', position: 'relative' }}>
          {/* Ruler/time markers */}
          <div
            className="relative h-6 border-b border-zinc-800 cursor-pointer bg-zinc-900/50"
            onMouseDown={handleRulerMouseDown}
          >
            {timeMarkers.map(t => (
              <div
                key={t}
                className="absolute top-0 flex flex-col items-center"
                style={{ left: t * PIXELS_PER_SECOND + 'px' }}
              >
                <div className="h-1.5 w-px bg-zinc-700 mt-0.5" />
                <span className="text-[9px] text-zinc-600 font-mono mt-0.5">
                  {formatTime(t)}
                </span>
              </div>
            ))}

            {/* Playhead on ruler */}
            <div
              className="absolute top-0 w-0.5 h-full bg-primary/70 z-20 pointer-events-none"
              style={{ left: playheadX + 'px' }}
            >
              <div className="w-2.5 h-2.5 bg-primary rounded-full -ml-[4.5px] -mt-1" />
            </div>
          </div>

          {/* Track lanes */}
          {tracks.map(track => (
            <div
              key={track.id}
              className="relative border-b border-zinc-800/50 last:border-b-0"
              style={{ height: TRACK_HEIGHT + 'px' }}
            >
              {/* Track label */}
              <div
                className="absolute left-0 top-0 bottom-0 w-20 flex items-center gap-1.5 px-2 z-10 bg-zinc-950/90 border-r border-zinc-800"
              >
                <span className="text-sm">{track.icon}</span>
                <span className="text-[10px] text-zinc-500 truncate">{track.label}</span>
              </div>

              {/* Track background */}
              <div className="ml-20 h-full relative">
                {/* Grid lines */}
                {timeMarkers.map(t => (
                  <div
                    key={t}
                    className="absolute top-0 w-px h-full bg-zinc-900"
                    style={{ left: t * PIXELS_PER_SECOND + 'px' }}
                  />
                ))}

                {/* Clips on this track */}
                {track.clips.map(clip => {
                  const left = clip.startTime * PIXELS_PER_SECOND
                  const width = (clip.endTime - clip.startTime) * PIXELS_PER_SECOND
                  const isActive = currentTime >= clip.startTime && currentTime <= clip.endTime
                  const isSelected = selectedClip?.trackId === track.id && selectedClip?.clipId === clip.id

                  return (
                    <div
                      key={clip.id}
                      className={cn(
                        'absolute top-1 bottom-1 rounded-md flex items-center px-2 cursor-pointer border transition-all group/item',
                        isActive ? 'brightness-110' : 'brightness-75',
                        isSelected
                          ? 'ring-2 ring-primary border-primary'
                          : 'border-transparent hover:border-white/20'
                      )}
                      style={{
                        left: left + 'px',
                        width: Math.max(width, 8) + 'px',
                        backgroundColor: track.color + '40',
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedClip({ trackId: track.id, clipId: clip.id })
                      }}
                    >
                      <span className="text-[9px] text-white/80 truncate font-medium">
                        {clip.label}
                      </span>

                      {/* Delete button on hover */}
                      {isSelected && (
                        <button
                          className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-400 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteClip(track.id, clip.id)
                            setSelectedClip(null)
                          }}
                        >
                          <X className="h-2.5 w-2.5 text-white" />
                        </button>
                      )}
                    </div>
                  )
                })}

                {/* Playhead line on tracks */}
                <div
                  className="absolute top-0 w-0.5 h-full bg-primary/50 z-20 pointer-events-none"
                  style={{ left: playheadX + 'px' }}
                />
              </div>
            </div>
          ))}

          {/* Empty state */}
          {tracks.length === 0 && (
            <div className="flex items-center justify-center h-20 text-zinc-600 text-xs">
              No tracks — add overlays, music, or voiceovers in the tabs above
            </div>
          )}
        </div>
      </div>

      {/* Track legend */}
      <div className="flex flex-wrap gap-2 text-[10px] text-zinc-600">
        {tracks.map(track => (
          <span key={track.id} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: track.color }} />
            {track.label}
            <span className="text-zinc-700">({track.clips.length})</span>
          </span>
        ))}
      </div>
    </div>
  )
}
