'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, Upload, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ThumbnailPickerProps {
  videoUrl: string
  duration: number
  thumbnail: string | null
  onThumbnailChange: (dataUrl: string | null) => void
}

export default function ThumbnailPicker({
  videoUrl,
  duration,
  thumbnail,
  onThumbnailChange,
}: ThumbnailPickerProps) {
  const [frames, setFrames] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-generate 6 frame thumbnails at even intervals
  useEffect(() => {
    if (!videoUrl || duration <= 0) return

    let cancelled = false
    setIsGenerating(true)

    const generateFrames = async () => {
      const video = document.createElement('video')
      video.src = videoUrl
      video.preload = 'auto'
      video.crossOrigin = 'anonymous'

      await new Promise<void>((resolve) => {
        video.addEventListener('loadedmetadata', () => resolve())
        video.load()
      })

      const intervals = [0, 0.2, 0.4, 0.6, 0.8, 1.0]
      const results: string[] = []

      for (const pct of intervals) {
        if (cancelled) return
        const time = pct * duration
        video.currentTime = time

        await new Promise<void>((resolve) => {
          video.addEventListener('seeked', () => resolve(), { once: true })
        })

        if (cancelled) return

        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 180
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, 320, 180)
          results.push(canvas.toDataURL('image/jpeg', 0.7))
        }
      }

      if (!cancelled) {
        setFrames(results)
        setIsGenerating(false)
      }
    }

    generateFrames()
    return () => { cancelled = true }
  }, [videoUrl, duration])

  const handleFrameSelect = (idx: number) => {
    setSelectedIdx(idx)
    onThumbnailChange(frames[idx])
  }

  const handleAuto = () => {
    // Pick middle frame
    const midIdx = Math.floor(frames.length / 2)
    if (frames[midIdx]) {
      setSelectedIdx(midIdx)
      onThumbnailChange(frames[midIdx])
    }
  }

  const handleCustomUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      onThumbnailChange(dataUrl)
      setSelectedIdx(null)
    }
    reader.readAsDataURL(file)
  }

  const handleRemove = () => {
    onThumbnailChange(null)
    setSelectedIdx(null)
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Thumbnail</h3>

      {isGenerating ? (
        <div className="flex items-center justify-center h-28 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-zinc-500">Generating thumbnails...</span>
          </div>
        </div>
      ) : frames.length > 0 ? (
        <>
          {/* Frame grid */}
          <div className="grid grid-cols-6 gap-2">
            {frames.map((dataUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleFrameSelect(idx)}
                className={cn(
                  'relative rounded-lg overflow-hidden border-2 transition-all aspect-video',
                  selectedIdx === idx
                    ? 'border-primary ring-2 ring-primary/30 scale-105'
                    : 'border-zinc-800 hover:border-zinc-600'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={dataUrl}
                  alt={`Frame ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                {idx === 0 && (
                  <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/70 text-white px-1 rounded">
                    Start
                  </span>
                )}
                {idx === frames.length - 1 && (
                  <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/70 text-white px-1 rounded">
                    End
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleAuto}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Auto
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleCustomUpload}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload custom
            </Button>

            {thumbnail && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-red-400 hover:text-red-300"
                onClick={handleRemove}
              >
                Remove
              </Button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Current selection view */}
          {thumbnail && (
            <div className="p-2 rounded-xl bg-zinc-900/50 border border-zinc-800">
              <p className="text-[11px] text-zinc-500 mb-1.5">Selected thumbnail:</p>
              <div className="flex items-center gap-3">
                <div className="w-28 h-16 rounded-lg overflow-hidden border border-zinc-700 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbnail} alt="Selected thumbnail" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-zinc-500">
                  {selectedIdx !== null
                    ? `Frame ${selectedIdx + 1} of 6`
                    : 'Custom image'}
                </span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-28 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <p className="text-sm text-zinc-600">Video loading...</p>
        </div>
      )}
    </div>
  )
}
