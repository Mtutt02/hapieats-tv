'use client'

// ============================================================
// HapiEats TV Studio — Export / Render Pipeline
// Real-time composited capture: the engine plays the project
// while canvas + mixed audio are recorded via MediaRecorder.
// Output uploads straight into the existing Mux pipeline.
// ============================================================

import type { EditorEngine } from './engine'
import { projectDuration } from './types'

export interface ExportOptions {
  fps?: number
  /** 720 | 1080 — capped by project resolution */
  maxHeight?: number
  bitrate?: number
  watermark?: boolean
  onProgress?: (pct: number, label: string) => void
  signal?: AbortSignal
}

export interface ExportResult {
  blob: Blob
  mimeType: string
  duration: number
}

export async function exportProject(engine: EditorEngine, opts: ExportOptions = {}): Promise<ExportResult> {
  const { fps = 30, bitrate = 8_000_000, onProgress, watermark = false, signal } = opts
  const duration = projectDuration(engine.getProject())
  if (duration <= 0.1) throw new Error('Nothing on the timeline to export')

  onProgress?.(0, 'Preparing media…')
  await engine.preload()
  engine.setMonitor(false) // silent export

  // capture streams
  const canvasStream = engine.canvas.captureStream(fps)
  const tracks = [
    ...canvasStream.getVideoTracks(),
    ...engine.streamDest.stream.getAudioTracks(),
  ]
  const mixed = new MediaStream(tracks)

  const mimeType = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ].find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || 'video/webm'

  const recorder = new MediaRecorder(mixed, { mimeType, videoBitsPerSecond: bitrate })
  const chunks: Blob[] = []
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
    recorder.onerror = () => reject(new Error('Recording failed'))
  })

  // watermark hook for free tier
  let wmInterval = 0
  if (watermark) {
    const ctx = engine.ctx
    wmInterval = window.setInterval(() => {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.filter = 'none'
      ctx.globalAlpha = 0.55
      ctx.font = `bold ${Math.round(engine.canvas.height / 28)}px Inter, sans-serif`
      ctx.textAlign = 'right'
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.lineWidth = 3
      const pad = engine.canvas.height / 36
      ctx.strokeText('HapiEats TV', engine.canvas.width - pad, engine.canvas.height - pad)
      ctx.fillText('HapiEats TV', engine.canvas.width - pad, engine.canvas.height - pad)
      ctx.restore()
    }, 1000 / fps)
  }

  recorder.start(500)
  engine.seek(0)
  await new Promise(r => setTimeout(r, 120))
  engine.play(0)

  onProgress?.(1, 'Rendering…')
  await new Promise<void>((resolve, reject) => {
    const started = performance.now()
    const poll = window.setInterval(() => {
      if (signal?.aborted) {
        window.clearInterval(poll)
        engine.pause()
        try { recorder.stop() } catch {}
        reject(new DOMException('Export cancelled', 'AbortError'))
        return
      }
      const elapsed = (performance.now() - started) / 1000
      const pct = Math.min(99, Math.round((elapsed / duration) * 100))
      onProgress?.(pct, 'Rendering…')
      if (!engine.isPlaying || elapsed >= duration + 0.5) {
        window.clearInterval(poll)
        resolve()
      }
    }, 250)
  })

  engine.pause()
  if (wmInterval) window.clearInterval(wmInterval)
  recorder.stop()
  const blob = await done
  engine.setMonitor(true)
  onProgress?.(100, 'Done')
  return { blob, mimeType, duration }
}

/**
 * Publish an exported render to the platform: creates a Mux direct upload
 * via the existing /api/videos/upload flow and pushes the blob with UpChunk.
 */
export async function publishToPlatform(
  result: ExportResult,
  meta: { title: string; description?: string },
  onProgress?: (pct: number) => void,
): Promise<{ videoId: string }> {
  // 1) signed direct-upload URL from Mux
  const res = await fetch('/api/mux/direct-upload')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Could not create upload')
  }
  const { uploadUrl, uploadId } = await res.json()
  if (!uploadUrl || !uploadId) throw new Error('Upload URL missing from server response')

  // 2) push the render with UpChunk
  const { createUpload } = await import('@mux/upchunk')
  const ext = result.mimeType.includes('mp4') ? 'mp4' : 'webm'
  const file = new File([result.blob], `${meta.title || 'studio-export'}.${ext}`, { type: result.mimeType })

  await new Promise<void>((resolve, reject) => {
    const up = createUpload({ endpoint: uploadUrl, file, chunkSize: 30720 })
    up.on('progress', (e: any) => onProgress?.(Math.round(e.detail)))
    up.on('success', () => resolve())
    up.on('error', (e: any) => reject(new Error(e?.detail?.message || 'Upload failed')))
  })

  // 3) create the platform video record
  const save = await fetch('/api/mux/editor-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      title: meta.title,
      description: meta.description || 'Created with HapiEats TV Studio',
    }),
  })
  if (!save.ok) {
    const err = await save.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to save video record')
  }
  const { videoId } = await save.json()
  return { videoId }
}

/** Local download fallback. */
export function downloadResult(result: ExportResult, title: string) {
  const ext = result.mimeType.includes('mp4') ? 'mp4' : 'webm'
  const a = document.createElement('a')
  a.href = URL.createObjectURL(result.blob)
  a.download = `${title.replace(/[^a-z0-9-_ ]/gi, '') || 'export'}.${ext}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000)
}
