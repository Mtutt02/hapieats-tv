'use client'

import { useState, useRef } from 'react'
import { X, Download, UploadCloud, Loader2, CheckCircle2, Crown, Clapperboard } from 'lucide-react'
import { useEditor } from '@/lib/editor/store'
import { exportProject, downloadResult, ExportResult } from '@/lib/editor/export'
import { useUploadStore } from '@/lib/upload-store'
import { engineRef } from './PreviewPanel'
import { usePremium } from './usePremium'

export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const title = useEditor(s => s.project.title)
  const aspect = useEditor(s => s.project.aspect)
  const { limits, isPremium, gate } = usePremium()
  const isVertical = aspect === '9:16'
  const [publishAsClip, setPublishAsClip] = useState(true)
  const [phase, setPhase] = useState<'idle' | 'rendering' | 'uploading' | 'done' | 'error'>('idle')
  const [pct, setPct] = useState(0)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [videoId, setVideoId] = useState<string | null>(null)
  const resultRef = useRef<ExportResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const render = async (): Promise<ExportResult | null> => {
    const engine = engineRef.current
    if (!engine) { setError('Editor engine not ready'); setPhase('error'); return null }
    setPhase('rendering')
    setError(null)
    abortRef.current = new AbortController()
    try {
      const result = await exportProject(engine, {
        watermark: limits.watermark,
        onProgress: (p, l) => { setPct(p); setLabel(l) },
        signal: abortRef.current.signal,
      })
      resultRef.current = result
      return result
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') {
        setError(e instanceof Error ? e.message : 'Render failed')
        setPhase('error')
      } else {
        setPhase('idle')
      }
      return null
    }
  }

  const doDownload = async () => {
    const result = resultRef.current || await render()
    if (!result) return
    downloadResult(result, title)
    setPhase('done')
  }

  const doPublish = async () => {
    const result = resultRef.current || await render()
    if (!result) return
    try {
      // Hand off to the app-wide background uploader (floating toast) so the
      // user can keep browsing while the render uploads.
      const ext = result.mimeType.includes('mp4') ? 'mp4' : 'webm'
      const file = new File([result.blob], `${title || 'studio-export'}.${ext}`, { type: result.mimeType })
      await useUploadStore.getState().startUpload(file, {
        title: title || 'Studio export',
        description: 'Created with HapiEats TV Studio',
        channelId: null,
        visibility: 'public',
        pricingModel: 'free',
        postType: 'general',
        tags: null,
        stationId: null,
        isClip: isVertical && publishAsClip,
        clipCategory: isVertical && publishAsClip ? 'food' : null,
      })
      const state = useUploadStore.getState()
      if (state.status === 'error') {
        setError(state.error || 'Publish failed')
        setPhase('error')
        return
      }
      setVideoId(state.videoId)
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed')
      setPhase('error')
    }
  }

  const busy = phase === 'rendering' || phase === 'uploading'

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Export “{title}”</h3>
          {!busy && (
            <button onClick={onClose} className="text-zinc-500 hover:text-white" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {!isPremium && (
          <button onClick={() => gate('Watermark-free 1080p export')} className="mt-3 flex w-full items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-left text-[11px] text-amber-300">
            <Crown className="h-3.5 w-3.5 shrink-0" /> Free exports include a small HapiEats TV watermark. Upgrade for clean 1080p.
          </button>
        )}

        {busy ? (
          <div className="mt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" /> {label}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-right font-mono text-[11px] text-zinc-500">{pct}%</p>
            {phase === 'rendering' && (
              <button onClick={() => abortRef.current?.abort()} className="mt-3 w-full rounded-lg border border-zinc-700 py-2 text-xs text-zinc-400 hover:bg-zinc-800">
                Cancel
              </button>
            )}
            <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
              Rendering plays your composition in real time while capturing every layer, keyframe, and audio mix — keep this tab focused for best results.
            </p>
          </div>
        ) : phase === 'done' ? (
          <div className="mt-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <p className="mt-2 text-sm font-semibold text-white">{videoId ? 'Uploading in the background!' : 'Export complete'}</p>
            {videoId ? (
              <>
                <p className="mt-1 text-xs text-zinc-500">
                  Your video is uploading — watch the progress toast and keep browsing the app while it finishes.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <a href="/" className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black hover:bg-emerald-400">
                    Browse while it uploads
                  </a>
                  <a href="/studio/videos" className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800">
                    My videos
                  </a>
                </div>
              </>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">Saved to your downloads.</p>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">{error}</p>}
            {isVertical && (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={publishAsClip}
                  onChange={e => setPublishAsClip(e.target.checked)}
                  className="h-3.5 w-3.5 accent-emerald-500"
                />
                <Clapperboard className="h-3.5 w-3.5 text-emerald-400" />
                Publish as a Clip
              </label>
            )}
            <button onClick={doPublish} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-black hover:opacity-90">
              <UploadCloud className="h-4 w-4" /> Publish to HapiEats TV
            </button>
            <button onClick={doDownload} className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-800">
              <Download className="h-4 w-4" /> Download file
            </button>
            <p className="text-center text-[10px] text-zinc-600">
              Publishing renders your edit, uploads it to Mux, and drops it in your video library.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
