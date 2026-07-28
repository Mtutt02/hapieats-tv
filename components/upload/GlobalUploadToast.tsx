'use client'

import { useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  UploadCloud, Film, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, X, Loader2,
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useUploadStore } from '@/lib/upload-store'

function processingEstimate(fileSizeBytes: number): string {
  const gb = fileSizeBytes / (1024 ** 3)
  if (gb < 0.5)  return 'Usually ready in 1–3 minutes.'
  if (gb < 2)    return 'Usually ready in 2–5 minutes.'
  if (gb < 6)    return 'Usually ready in 5–15 minutes.'
  if (gb < 12)   return 'Large file — may take 15–45 minutes to encode.'
  return 'Very large file — encoding may take up to an hour. We\'ll notify you when it\'s done.'
}

export default function GlobalUploadToast() {
  const { status, progress, fileName, fileSize, videoId, error, minimized, dismiss, setMinimized, setDone } = useUploadStore()

  // Poll for Mux processing completion when upload finishes
  const pollReady = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/videos/${id}/status`)
      const data = await res.json()
      if (data.status === 'ready') setDone()
    } catch {
      // Retry on next interval
    }
  }, [setDone])

  useEffect(() => {
    if (status !== 'processing' || !videoId) return
    // Immediate check, then every 6 s
    pollReady(videoId)
    const t = setInterval(() => pollReady(videoId), 6000)
    return () => clearInterval(t)
  }, [status, videoId, pollReady])

  if (status === 'idle') return null

  const isUploading  = status === 'uploading'
  const isProcessing = status === 'processing'
  const isDone       = status === 'done'
  const isError      = status === 'error'

  return (
    <div
      className="fixed bottom-[5.5rem] md:bottom-6 right-4 z-[200] w-80 max-w-[calc(100vw-2rem)]"
      role="status"
      aria-live="polite"
    >
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-800">
          {/* Status icon */}
          <div className={cn(
            'h-7 w-7 flex items-center justify-center rounded-full flex-shrink-0',
            isUploading  ? 'bg-primary/20' :
            isProcessing ? 'bg-amber-500/20' :
            isDone       ? 'bg-green-500/20' :
                           'bg-red-500/20',
          )}>
            {isUploading  && <UploadCloud className="h-3.5 w-3.5 text-primary animate-pulse" />}
            {isProcessing && <Loader2    className="h-3.5 w-3.5 text-amber-400 animate-spin" />}
            {isDone       && <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
            {isError      && <AlertCircle  className="h-3.5 w-3.5 text-red-400" />}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white leading-none">
              {isUploading  ? `Uploading ${progress}%` :
               isProcessing ? 'Processing video…' :
               isDone       ? 'Upload complete!' :
                              'Upload failed'}
            </p>
            <p className="text-[10px] text-zinc-500 truncate mt-0.5">{fileName}</p>
          </div>

          <button
            onClick={() => setMinimized(!minimized)}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded"
            aria-label={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={dismiss}
            className="text-zinc-500 hover:text-red-400 transition-colors p-1 rounded"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── Body (collapsible) ─────────────────────────────────── */}
        {!minimized && (
          <div className="px-4 py-3 space-y-3">

            {isUploading && (
              <>
                <Progress value={progress} className="h-1.5 bg-zinc-800" />
                <p className="text-[11px] text-zinc-500 leading-snug">
                  You can browse the app — your upload continues in the background.
                </p>
              </>
            )}

            {isProcessing && (
              <div className="flex items-start gap-2.5">
                <Film className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-zinc-400 leading-snug">
                  {processingEstimate(fileSize)} Keep browsing — we'll notify you when it's ready.
                </p>
              </div>
            )}

            {isDone && videoId && (
              <div className="flex gap-2">
                <Link
                  href={`/watch/${videoId}`}
                  onClick={dismiss}
                  className="flex-1 text-center text-xs bg-primary text-primary-foreground rounded-xl py-2 font-semibold hover:bg-primary/90 transition-colors"
                >
                  Watch Now
                </Link>
                <Link
                  href="/studio/videos"
                  onClick={dismiss}
                  className="flex-1 text-center text-xs bg-zinc-800 text-zinc-200 rounded-xl py-2 font-semibold hover:bg-zinc-700 transition-colors"
                >
                  My Videos
                </Link>
              </div>
            )}

            {isError && (
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-400 leading-snug">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
