'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Scissors, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, RotateCcw, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface VideoEditorProps {
  file: File
  onClipSelected: (startTime: number, endTime: number, duration: number) => void
  onCancel: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}

export default function VideoEditor({ file, onClipSelected, onCancel }: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [thumbnails, setThumbnails] = useState<string[]>([])

  // Create object URL for the video file
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Generate timeline thumbnails
  useEffect(() => {
    if (!videoUrl || duration === 0) return
    const canvas = document.createElement('canvas')
    canvas.width = 80
    canvas.height = 45
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const vid = document.createElement('video')
    vid.src = videoUrl
    vid.muted = true
    vid.crossOrigin = 'anonymous'

    const count = 12
    const generated: string[] = []
    let captured = 0

    vid.addEventListener('loadedmetadata', () => {
      const step = vid.duration / count
      const capture = (i: number) => {
        if (i >= count) {
          setThumbnails(generated)
          return
        }
        vid.currentTime = i * step
        vid.addEventListener('seeked', function onSeeked() {
          vid.removeEventListener('seeked', onSeeked)
          ctx.drawImage(vid, 0, 0, 80, 45)
          generated[i] = canvas.toDataURL('image/jpeg', 0.5)
          captured++
          capture(i + 1)
        })
      }
      capture(0)
    })
    vid.load()
  }, [videoUrl, duration])

  const handleMetadata = () => {
    if (!videoRef.current) return
    const d = videoRef.current.duration
    setDuration(d)
    setTrimEnd(d)
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const t = videoRef.current.currentTime
    setCurrentTime(t)
    // Loop within trim range during preview
    if (t >= trimEnd) {
      videoRef.current.currentTime = trimStart
    }
  }

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      if (videoRef.current.currentTime >= trimEnd) {
        videoRef.current.currentTime = trimStart
      }
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const seekTo = (pct: number) => {
    if (!videoRef.current || duration === 0) return
    const t = pct * duration
    videoRef.current.currentTime = t
    setCurrentTime(t)
  }

  const skipToStart = () => {
    if (!videoRef.current) return
    videoRef.current.currentTime = trimStart
    setCurrentTime(trimStart)
  }

  const skipToEnd = () => {
    if (!videoRef.current) return
    videoRef.current.currentTime = Math.max(0, trimEnd - 0.1)
    setCurrentTime(Math.max(0, trimEnd - 0.1))
  }

  // Timeline drag handling
  const getTimelinePosition = useCallback((clientX: number): number => {
    if (!timelineRef.current) return 0
    const rect = timelineRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return pct * duration
  }, [duration])

  const handleTimelineMouseDown = (e: React.MouseEvent, handle: 'start' | 'end') => {
    e.preventDefault()
    setIsDragging(handle)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const t = getTimelinePosition(e.clientX)
      if (isDragging === 'start') {
        const newStart = Math.min(t, trimEnd - 1)
        setTrimStart(Math.max(0, newStart))
        if (videoRef.current) videoRef.current.currentTime = Math.max(0, newStart)
      } else {
        const newEnd = Math.max(t, trimStart + 1)
        setTrimEnd(Math.min(duration, newEnd))
        if (videoRef.current) videoRef.current.currentTime = Math.min(duration, newEnd)
      }
    }

    const handleMouseUp = () => setIsDragging(null)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, trimStart, trimEnd, duration, getTimelinePosition])

  const clipDuration = trimEnd - trimStart
  const startPct = duration > 0 ? (trimStart / duration) * 100 : 0
  const endPct = duration > 0 ? (trimEnd / duration) * 100 : 100
  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleConfirm = () => {
    onClipSelected(trimStart, trimEnd, clipDuration)
  }

  const handleReset = () => {
    setTrimStart(0)
    setTrimEnd(duration)
    if (videoRef.current) videoRef.current.currentTime = 0
    setCurrentTime(0)
  }

  return (
    <div className="space-y-4">
      {/* Video preview */}
      <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
        {videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            onLoadedMetadata={handleMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            playsInline
          />
        )}

        {/* Trim info overlay */}
        <div className="absolute top-3 left-3 right-3 flex justify-between">
          <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-md font-mono">
            {formatTime(trimStart)}
          </span>
          <span className="bg-primary/90 text-white text-xs px-2 py-1 rounded-md font-mono">
            Clip: {formatTime(clipDuration)}
          </span>
          <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-md font-mono">
            {formatTime(trimEnd)}
          </span>
        </div>
      </div>

      {/* Transport controls */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="ghost" size="icon" onClick={skipToStart}>
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button variant="default" size="icon" className="h-10 w-10 rounded-full" onClick={togglePlay}>
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={skipToEnd}>
          <SkipForward className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleMute}>
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
        <span className="text-xs text-muted-foreground font-mono ml-2">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Timeline with trim handles */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Scissors className="h-3.5 w-3.5 text-primary" />
          <span>Drag the orange handles to trim your clip</span>
        </div>

        <div
          ref={timelineRef}
          className="relative h-14 rounded-lg overflow-hidden cursor-crosshair select-none"
          style={{ background: '#1a1a1a' }}
          onClick={(e) => {
            if (!isDragging) seekTo(getTimelinePosition(e.clientX) / duration)
          }}
        >
          {/* Thumbnail strip */}
          <div className="absolute inset-0 flex">
            {thumbnails.length > 0
              ? thumbnails.map((src, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-cover bg-center"
                    style={{ backgroundImage: `url(${src})` }}
                  />
                ))
              : Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex-1 bg-muted/30 border-r border-muted/10" />
                ))}
          </div>

          {/* Dimmed areas outside trim */}
          <div
            className="absolute inset-y-0 left-0 bg-black/60 pointer-events-none"
            style={{ width: `${startPct}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-black/60 pointer-events-none"
            style={{ width: `${100 - endPct}%` }}
          />

          {/* Active trim region border */}
          <div
            className="absolute inset-y-0 border-2 border-primary pointer-events-none"
            style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
          />

          {/* Start handle */}
          <div
            className={cn(
              'absolute inset-y-0 w-4 flex items-center justify-center cursor-ew-resize z-10',
              'bg-primary rounded-l',
              isDragging === 'start' && 'bg-primary/80'
            )}
            style={{ left: `${startPct}%`, transform: 'translateX(-50%)' }}
            onMouseDown={(e) => handleTimelineMouseDown(e, 'start')}
          >
            <div className="w-0.5 h-5 bg-white/80 rounded-full" />
          </div>

          {/* End handle */}
          <div
            className={cn(
              'absolute inset-y-0 w-4 flex items-center justify-center cursor-ew-resize z-10',
              'bg-primary rounded-r',
              isDragging === 'end' && 'bg-primary/80'
            )}
            style={{ left: `${endPct}%`, transform: 'translateX(-50%)' }}
            onMouseDown={(e) => handleTimelineMouseDown(e, 'end')}
          >
            <div className="w-0.5 h-5 bg-white/80 rounded-full" />
          </div>

          {/* Playhead */}
          <div
            className="absolute inset-y-0 w-0.5 bg-white/90 pointer-events-none z-20"
            style={{ left: `${playheadPct}%` }}
          >
            <div className="w-3 h-3 bg-white rounded-full -mt-1 -ml-1.5" />
          </div>
        </div>

        {/* Time labels */}
        <div className="flex justify-between text-xs text-muted-foreground font-mono">
          <span>0:00</span>
          <span>{formatTime(duration / 4)}</span>
          <span>{formatTime(duration / 2)}</span>
          <span>{formatTime((duration * 3) / 4)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Clip info & actions */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
        <div className="text-sm">
          <span className="text-muted-foreground">Selected clip: </span>
          <span className="font-semibold text-primary">{formatTime(clipDuration)}</span>
          <span className="text-muted-foreground ml-2">
            ({formatTime(trimStart)} → {formatTime(trimEnd)})
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1 gap-2" onClick={handleConfirm}>
          <Check className="h-4 w-4" />
          Use This Clip
        </Button>
      </div>
    </div>
  )
}
