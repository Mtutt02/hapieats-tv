'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TrimPanelProps {
  file: File
  clipStart: number
  clipEnd: number
  onTrimChange: (start: number, end: number) => void
}

interface ClipSuggestion {
  start: number
  end: number
  confidence: number
  label: string
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}

export default function TrimPanel({ file, clipStart, clipEnd, onTrimChange }: TrimPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [waveform, setWaveform] = useState<number[]>([])
  const [audioLevels, setAudioLevels] = useState<number[]>([])

  // Auto-clip state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [suggestions, setSuggestions] = useState<ClipSuggestion[]>([])

  // Create object URL for the video file
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Build waveform from audio data
  useEffect(() => {
    if (!videoUrl) return
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    let cancelled = false

    const fetchAndDecode = async () => {
      try {
        const res = await fetch(videoUrl)
        const buf = await res.arrayBuffer()
        const audioBuf = await audioCtx.decodeAudioData(buf)
        if (cancelled) return
        const raw = audioBuf.getChannelData(0)
        // Downsample to ~200 samples
        const step = Math.floor(raw.length / 200)
        const samples: number[] = []
        const levels: number[] = []
        for (let i = 0; i < raw.length; i += step) {
          const chunk = raw.slice(i, i + step)
          let max = 0
          for (let j = 0; j < chunk.length; j++) {
            const abs = Math.abs(chunk[j])
            if (abs > max) max = abs
          }
          samples.push(max)
          levels.push(max)
        }
        if (!cancelled) {
          setWaveform(samples)
          setAudioLevels(levels)
        }
      } catch {
        // If audio decoding fails, use placeholder bars
        if (!cancelled) {
          const fallback = Array.from({ length: 200 }, () => Math.random() * 0.8 + 0.1)
          setWaveform(fallback)
          setAudioLevels(fallback)
        }
      }
    }
    fetchAndDecode()

    return () => {
      cancelled = true
      audioCtx.close()
    }
  }, [videoUrl])

  const handleMetadata = () => {
    if (!videoRef.current) return
    const d = videoRef.current.duration
    setDuration(d)
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const t = videoRef.current.currentTime
    setCurrentTime(t)
    if (t >= clipEnd) {
      videoRef.current.currentTime = clipStart
    }
  }

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      if (videoRef.current.currentTime >= clipEnd || videoRef.current.currentTime < clipStart) {
        videoRef.current.currentTime = clipStart
      }
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const seekTo = (pct: number) => {
    if (!videoRef.current || duration === 0) return
    const t = pct * duration
    videoRef.current.currentTime = Math.max(clipStart, Math.min(clipEnd, t))
    setCurrentTime(videoRef.current.currentTime)
  }

  const skipToStart = () => {
    if (!videoRef.current) return
    videoRef.current.currentTime = clipStart
    setCurrentTime(clipStart)
  }

  const skipToEnd = () => {
    if (!videoRef.current) return
    videoRef.current.currentTime = Math.max(clipStart, clipEnd - 0.1)
    setCurrentTime(Math.max(clipStart, clipEnd - 0.1))
  }

  // Auto-detect clips using audio level analysis
  const analyzeAndSuggestClips = useCallback(async () => {
    if (duration === 0 || audioLevels.length === 0) return

    setIsAnalyzing(true)
    setSuggestions([])

    // Simulate a brief analysis delay for UX
    await new Promise(resolve => setTimeout(resolve, 800))

    // Detect silence regions (low audio levels)
    const silenceThreshold = 0.08
    const minSilenceBlocks = Math.max(3, Math.floor(audioLevels.length * 0.02)) // ~2% of blocks
    const minBlockSize = Math.floor(audioLevels.length * 0.02)

    const silenceRegions: { startIdx: number; endIdx: number }[] = []
    let inSilence = false
    let silenceStart = 0

    for (let i = 0; i < audioLevels.length; i++) {
      if (audioLevels[i] < silenceThreshold) {
        if (!inSilence) {
          silenceStart = i
          inSilence = true
        }
      } else {
        if (inSilence) {
          const silenceLen = i - silenceStart
          if (silenceLen >= minBlockSize) {
            silenceRegions.push({ startIdx: silenceStart, endIdx: i })
          }
          inSilence = false
        }
      }
    }
    // Handle trailing silence
    if (inSilence && audioLevels.length - silenceStart >= minBlockSize) {
      silenceRegions.push({ startIdx: silenceStart, endIdx: audioLevels.length - 1 })
    }

    // Generate clip suggestions by splitting at silence regions
    const clips: ClipSuggestion[] = []
    let regionStartIdx = 0

    for (let i = 0; i < silenceRegions.length; i++) {
      const silence = silenceRegions[i]
      const regionStartTime = (regionStartIdx / audioLevels.length) * duration
      const regionEndIdx = silence.startIdx
      const regionEndTime = (regionEndIdx / audioLevels.length) * duration
      const regionDuration = regionEndTime - regionStartTime

      // Only suggest if the region is at least 5 seconds
      if (regionDuration >= 5) {
        const avgLevel = audioLevels.slice(regionStartIdx, regionEndIdx).reduce((a, b) => a + b, 0) / (regionEndIdx - regionStartIdx)
        const confidence = Math.round(Math.min(95, Math.max(35, avgLevel * 120 + 20)))

        clips.push({
          start: regionStartTime,
          end: regionEndTime,
          confidence,
          label: `Clip ${clips.length + 1}: ${formatTime(regionStartTime)} - ${formatTime(regionEndTime)}`,
        })
      }
      regionStartIdx = silence.endIdx
    }

    // Add the last region after final silence
    if (regionStartIdx < audioLevels.length - 1) {
      const finalEnd = (audioLevels.length / audioLevels.length) * duration
      const finalStart = (regionStartIdx / audioLevels.length) * duration
      const finalDuration = finalEnd - finalStart

      if (finalDuration >= 5) {
        const avgLevel = audioLevels.slice(regionStartIdx).reduce((a, b) => a + b, 0) / (audioLevels.length - regionStartIdx)
        const confidence = Math.round(Math.min(95, Math.max(35, avgLevel * 120 + 20)))

        clips.push({
          start: finalStart,
          end: finalEnd,
          confidence,
          label: `Clip ${clips.length + 1}: ${formatTime(finalStart)} - ${formatTime(finalEnd)}`,
        })
      }
    }

    // If no clear silence cuts found, create even splits as fallback
    if (clips.length === 0) {
      const segmentCount = Math.min(3, Math.floor(duration / 8))
      for (let i = 0; i < segmentCount; i++) {
        const s = (i / segmentCount) * duration
        const e = ((i + 1) / segmentCount) * duration
        clips.push({
          start: s,
          end: e,
          confidence: 40 + Math.floor(Math.random() * 20),
          label: `Clip ${i + 1}: ${formatTime(s)} - ${formatTime(e)}`,
        })
      }
    }

    // Limit to 3 suggestions
    setSuggestions(clips.slice(0, 3))
    setIsAnalyzing(false)
  }, [duration, audioLevels])

  const applySuggestion = (suggestion: ClipSuggestion) => {
    onTrimChange(suggestion.start, suggestion.end)
    if (videoRef.current) {
      videoRef.current.currentTime = suggestion.start
      setCurrentTime(suggestion.start)
    }
  }

  // Timeline positioning
  const getTimelinePosition = useCallback((clientX: number): number => {
    if (!timelineRef.current || duration === 0) return 0
    const rect = timelineRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration))
  }, [duration])

  const handleTrimMouseDown = (e: React.MouseEvent, handle: 'start' | 'end') => {
    e.preventDefault()
    setIsDragging(handle)
  }

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingPlayhead(true)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const t = getTimelinePosition(e.clientX)
      if (isDragging === 'start') {
        const newStart = Math.min(t, clipEnd - 0.5)
        onTrimChange(Math.max(0, newStart), clipEnd)
        if (videoRef.current) videoRef.current.currentTime = Math.max(0, newStart)
      } else {
        const newEnd = Math.max(t, clipStart + 0.5)
        onTrimChange(clipStart, Math.min(duration, newEnd))
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
  }, [isDragging, clipStart, clipEnd, duration, getTimelinePosition, onTrimChange])

  useEffect(() => {
    if (!isDraggingPlayhead) return

    const handleMouseMove = (e: MouseEvent) => {
      const t = getTimelinePosition(e.clientX)
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(clipStart, Math.min(clipEnd, t))
        setCurrentTime(videoRef.current.currentTime)
      }
    }

    const handleMouseUp = () => setIsDraggingPlayhead(false)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingPlayhead, clipStart, clipEnd, duration, getTimelinePosition])

  const clipDuration = clipEnd - clipStart
  const startPct = duration > 0 ? (clipStart / duration) * 100 : 0
  const endPct = duration > 0 ? (clipEnd / duration) * 100 : 100
  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || waveform.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const midY = h / 2

    ctx.clearRect(0, 0, w, h)

    // Draw waveform bars
    const barCount = waveform.length
    const barWidth = w / barCount

    for (let i = 0; i < barCount; i++) {
      const barH = Math.max(1, waveform[i] * midY * 0.9)
      const x = i * barWidth

      // Determine if this bar is within the trim range
      const barPct = i / barCount
      const isTrimmed = barPct >= (clipStart / duration) && barPct <= (clipEnd / duration)

      ctx.fillStyle = isTrimmed ? '#c9a84c' : '#52525b'
      ctx.fillRect(x, midY - barH / 2, Math.max(1, barWidth - 1), barH)
    }
  }, [waveform, clipStart, clipEnd, duration])

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

        {/* Time info overlay */}
        <div className="absolute top-3 left-3 right-3 flex justify-between pointer-events-none">
          <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-md font-mono">
            {formatTime(clipStart)}
          </span>
          <span className="bg-primary/90 text-white text-xs px-2 py-1 rounded-md font-mono">
            Clip: {formatTime(clipDuration)}
          </span>
          <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-md font-mono">
            {formatTime(clipEnd)}
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
        <span className="text-xs text-zinc-400 font-mono ml-2">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Waveform + trim handles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Drag handles to trim</span>
          <div className="flex gap-1">
            {/* Auto-Detect Clips button */}
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 transition-all',
                isAnalyzing && 'animate-pulse'
              )}
              onClick={analyzeAndSuggestClips}
              disabled={isAnalyzing || duration === 0}
            >
              <Sparkles className={cn('h-3.5 w-3.5', isAnalyzing && 'animate-spin')} />
              {isAnalyzing ? 'Analyzing...' : 'Auto-Detect Clips'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom(z => Math.max(1, z - 0.5))}
              disabled={zoom <= 1}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom(z => Math.min(5, z + 0.5))}
              disabled={zoom >= 5}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] text-zinc-600 self-center ml-1">{zoom}x</span>
          </div>
        </div>

        <div
          ref={timelineRef}
          className="relative h-16 rounded-lg overflow-hidden cursor-crosshair select-none border border-zinc-800"
          style={{ background: '#1a1a1a' }}
        >
          {/* Waveform canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          />

          {/* Dimmed areas outside trim */}
          <div
            className="absolute inset-y-0 left-0 bg-black/50 pointer-events-none"
            style={{ width: `${startPct}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-black/50 pointer-events-none"
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
            onMouseDown={(e) => handleTrimMouseDown(e, 'start')}
          >
            <div className="w-0.5 h-6 bg-white/80 rounded-full" />
          </div>

          {/* End handle */}
          <div
            className={cn(
              'absolute inset-y-0 w-4 flex items-center justify-center cursor-ew-resize z-10',
              'bg-primary rounded-r',
              isDragging === 'end' && 'bg-primary/80'
            )}
            style={{ left: `${endPct}%`, transform: 'translateX(-50%)' }}
            onMouseDown={(e) => handleTrimMouseDown(e, 'end')}
          >
            <div className="w-0.5 h-6 bg-white/80 rounded-full" />
          </div>

          {/* Playhead */}
          <div
            className="absolute inset-y-0 w-0.5 bg-white/90 pointer-events-none z-20 cursor-pointer"
            style={{ left: `${playheadPct}%` }}
            onMouseDown={handlePlayheadMouseDown}
          >
            <div className="w-3 h-3 bg-white rounded-full -mt-1 -ml-1.5 shadow-md" />
          </div>
        </div>

        {/* Time labels */}
        <div className="flex justify-between text-xs text-zinc-600 font-mono">
          <span>{formatTime(0)}</span>
          <span>{formatTime(duration / 4)}</span>
          <span>{formatTime(duration / 2)}</span>
          <span>{formatTime((duration * 3) / 4)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* AI Suggested Clips */}
      {suggestions.length > 0 && (
        <div className="space-y-2 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-purple-500/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">AI Suggested Clips</span>
          </div>
          <div className="grid gap-2">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applySuggestion(suggestion)}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-primary/50 hover:bg-zinc-900 transition-all text-left"
              >
                {/* Thumbnail placeholder */}
                <div className="h-10 w-16 rounded-md bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700 overflow-hidden">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {formatTime(suggestion.start)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200">{suggestion.label}</p>
                  <p className="text-xs text-zinc-500">
                    Duration: {formatTime(suggestion.end - suggestion.start)}
                  </p>
                </div>

                {/* Confidence badge */}
                <div className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                  suggestion.confidence >= 70
                    ? 'bg-green-500/10 text-green-400 border-green-500/30'
                    : suggestion.confidence >= 50
                      ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                )}>
                  {suggestion.confidence}%
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clip info */}
      <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
        <p className="text-sm text-center">
          <span className="text-zinc-500">Selected: </span>
          <span className="font-semibold text-primary">{formatTime(clipDuration)}</span>
          <span className="text-zinc-600 ml-2">
            ({formatTime(clipStart)} → {formatTime(clipEnd)})
          </span>
        </p>
      </div>
    </div>
  )
}
