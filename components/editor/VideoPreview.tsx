'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Play, Pause, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Overlay, FilterSettings } from './types'

interface VideoPreviewProps {
  videoUrl: string
  overlays: Overlay[]
  filters: FilterSettings
  currentTime: number
  isPlaying: boolean
  duration: number
  onTimeUpdate?: (time: number) => void
  onPlayPause?: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}

function getFilterStyle(filters: FilterSettings): React.CSSProperties {
  const style: React.CSSProperties = {}
  const filterParts: string[] = []

  if (filters.preset === 'vintage') {
    filterParts.push('sepia(0.4)')
    filterParts.push('brightness(1.1)')
    filterParts.push('contrast(0.9)')
    filterParts.push('saturate(0.8)')
  } else if (filters.preset === 'noir') {
    filterParts.push('grayscale(1)')
    filterParts.push('contrast(1.3)')
    filterParts.push('brightness(0.9)')
  } else if (filters.preset === 'cinematic') {
    filterParts.push('sepia(0.15)')
    filterParts.push('contrast(1.2)')
    filterParts.push('saturate(0.7)')
  } else if (filters.preset === 'warm') {
    filterParts.push('sepia(0.2)')
    filterParts.push('saturate(1.2)')
    filterParts.push('brightness(1.05)')
  } else if (filters.preset === 'cool') {
    filterParts.push('hue-rotate(200deg)')
    filterParts.push('saturate(0.9)')
    filterParts.push('brightness(0.95)')
  } else if (filters.preset === 'dramatic') {
    filterParts.push('contrast(1.5)')
    filterParts.push('brightness(0.85)')
    filterParts.push('saturate(1.3)')
  }

  // Manual adjustments (stacked on top of preset)
  if (filters.brightness !== 0) filterParts.push(`brightness(${1 + filters.brightness / 100})`)
  if (filters.contrast !== 0) filterParts.push(`contrast(${1 + filters.contrast / 100})`)
  if (filters.saturation !== 0) filterParts.push(`saturate(${1 + filters.saturation / 100})`)
  if (filters.blur > 0) filterParts.push(`blur(${filters.blur}px)`)

  if (filterParts.length > 0) {
    style.filter = filterParts.join(' ')
  }

  // Warmth is tricky in CSS — simulate with hue-rotate + sepia
  if (filters.warmth !== 0) {
    const warmthFilter = filters.warmth > 0
      ? `sepia(${filters.warmth / 200})`
      : `hue-rotate(${filters.warmth * 2}deg)`
    if (style.filter) {
      style.filter += ` ${warmthFilter}`
    } else {
      style.filter = warmthFilter
    }
  }

  return style
}

export default function VideoPreview({
  videoUrl,
  overlays,
  filters,
  currentTime,
  isPlaying,
  duration,
  onTimeUpdate,
  onPlayPause,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number>(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [canvasReady, setCanvasReady] = useState(false)

  const drawFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
    }
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height

    // Clear canvas
    ctx.clearRect(0, 0, w, h)

    // Draw video frame
    if (video.readyState >= 2) {
      const vw = video.videoWidth
      const vh = video.videoHeight
      const scale = Math.min(w / vw, h / vh)
      const dx = (w - vw * scale) / 2
      const dy = (h - vh * scale) / 2
      ctx.drawImage(video, dx, dy, vw * scale, vh * scale)
    }

    // Apply CSS filter to canvas by filtering the drawn image data
    // We apply the filter via the canvas context filter
    if (filters.preset || filters.brightness !== 0 || filters.contrast !== 0 || filters.saturation !== 0 || filters.warmth !== 0 || filters.blur > 0) {
      const cssFilter = getFilterStyle(filters).filter as string
      if (cssFilter) {
        // We need to get the image data, apply filter, and put it back
        // For performance, use context.filter
        ctx.filter = cssFilter
        // Redraw over itself with filter
        ctx.drawImage(video, dx, dy, vw * scale, vh * scale)
        ctx.filter = 'none'
      }
    }

    // Draw overlays
    const now = video.currentTime
    const activeOverlays = overlays.filter(o => now >= o.startTime && now <= o.endTime)

    for (const overlay of activeOverlays) {
      const ox = (overlay.x / 100) * w
      const oy = (overlay.y / 100) * h

      ctx.save()

      if (overlay.type === 'text') {
        ctx.font = `bold ${overlay.fontSize || 40}px system-ui, sans-serif`
        ctx.fillStyle = overlay.color || '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // Text shadow for readability
        ctx.shadowColor = 'rgba(0,0,0,0.6)'
        ctx.shadowBlur = 4
        ctx.shadowOffsetX = 1
        ctx.shadowOffsetY = 1

        ctx.fillText(overlay.content, ox, oy)
      } else if (overlay.type === 'emoji') {
        const size = overlay.size || 48
        ctx.font = `${size}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(overlay.content, ox, oy)
      }

      ctx.restore()
    }

    animFrameRef.current = requestAnimationFrame(drawFrame)
  }, [overlays, filters])

  // Setup video + canvas rendering loop
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoaded = () => {
      setCanvasReady(true)
    }

    video.addEventListener('loadeddata', handleLoaded)
    video.addEventListener('seeked', handleLoaded)

    // Start render loop
    animFrameRef.current = requestAnimationFrame(drawFrame)

    return () => {
      video.removeEventListener('loadeddata', handleLoaded)
      video.removeEventListener('seeked', handleLoaded)
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [drawFrame, videoUrl])

  // Sync video time when currentTime prop changes externally
  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) return
    if (Math.abs(video.currentTime - currentTime) > 0.1) {
      video.currentTime = currentTime
    }
  }, [currentTime, videoUrl])

  // Sync play/pause
  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) return
    if (isPlaying && video.paused) {
      video.play().catch(() => {})
    } else if (!isPlaying && !video.paused) {
      video.pause()
    }
  }, [isPlaying, videoUrl])

  const handleTimeUpdate = () => {
    if (videoRef.current && onTimeUpdate) {
      onTimeUpdate(videoRef.current.currentTime)
    }
  }

  const handleFullscreen = async () => {
    if (!containerRef.current) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      setIsFullscreen(false)
    } else {
      await containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    }
  }

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-xl overflow-hidden aspect-video group"
    >
      {/* Hidden video element for frame source */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="hidden"
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => onPlayPause?.()}
        playsInline
        preload="auto"
      />

      {/* Canvas compositor */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={getFilterStyle(filters)}
      />

      {/* Center play/pause overlay */}
      {!isPlaying && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/10"
          onClick={onPlayPause}
        >
          <div className="h-16 w-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg hover:bg-primary transition-colors">
            <Play className="h-8 w-8 text-white ml-1" />
          </div>
        </div>
      )}

      {/* Time info */}
      <div className="absolute top-3 left-3 right-3 flex justify-between pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-md font-mono">
          {formatTime(currentTime)}
        </span>
        <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-md font-mono">
          {formatTime(duration)}
        </span>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={onPlayPause}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </Button>

          {/* Progress bar */}
          <div className="flex-1 h-1.5 rounded-full bg-white/30 cursor-pointer relative"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const pct = (e.clientX - rect.left) / rect.width
              if (videoRef.current && onTimeUpdate) {
                const t = pct * duration
                videoRef.current.currentTime = t
                onTimeUpdate(t)
              }
            }}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>

          <span className="text-xs text-white/80 font-mono shrink-0">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={handleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Overlay count badge */}
      {overlays.length > 0 && (
        <div className="absolute top-3 right-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="bg-primary/80 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
            {overlays.length} overlay{overlays.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Filter badge */}
      {filters.preset && filters.preset !== 'none' && (
        <div className="absolute top-10 right-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="bg-purple-500/80 text-white text-[10px] px-2 py-0.5 rounded-full font-medium capitalize">
            {filters.preset}
          </span>
        </div>
      )}
    </div>
  )
}
