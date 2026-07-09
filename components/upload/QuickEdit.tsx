'use client'

// ============================================================
// Quick Edit — fast one-screen editor for the upload flow.
// Trim · filter · one text overlay · music · everything live
// on a single preview. For deep edits, hands the file off to
// the full Studio Editor.
// ============================================================

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Play, Pause, Check, X, Wand2, Music, Type as TypeIcon, Loader2, ArrowUpRight } from 'lucide-react'
import type { EditorOutput, Overlay } from '@/components/editor/types'
import { DEFAULT_FILTERS } from '@/components/editor/types'
import { MUSIC_LIBRARY } from '@/components/editor/music-data'

interface Props {
  files: File[]
  onComplete: (output: EditorOutput) => void
  onCancel: () => void
}

const PRESETS = [
  { id: null, label: 'Original' },
  { id: 'warm', label: 'Warm' },
  { id: 'fresh', label: 'Fresh' },
  { id: 'golden', label: 'Golden' },
  { id: 'cinematic', label: 'Cinema' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'noir', label: 'Noir' },
  { id: 'dramatic', label: 'Drama' },
] as const

const PRESET_CSS: Record<string, string> = {
  vintage: 'sepia(0.4) brightness(1.1) contrast(0.9) saturate(0.8)',
  noir: 'grayscale(1) contrast(1.3) brightness(0.9)',
  cinematic: 'sepia(0.15) contrast(1.2) saturate(0.7)',
  warm: 'sepia(0.2) saturate(1.2) brightness(1.05)',
  golden: 'sepia(0.35) saturate(1.35) brightness(1.08) contrast(1.05)',
  fresh: 'saturate(1.4) brightness(1.06) contrast(1.02)',
  dramatic: 'contrast(1.5) brightness(0.85) saturate(1.3)',
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`

export default function QuickEdit({ files, onComplete, onCancel }: Props) {
  const file = files[0]
  const videoRef = useRef<HTMLVideoElement>(null)
  const url = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [preset, setPreset] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [textPos, setTextPos] = useState<'top' | 'middle' | 'bottom'>('bottom')
  const [textColor, setTextColor] = useState('#ffffff')
  const [musicId, setMusicId] = useState<string | null>(null)
  const [handoff, setHandoff] = useState(false)

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const onMeta = () => {
    const d = videoRef.current?.duration || 0
    setDuration(d)
    setEnd(d)
  }

  // loop playback inside the trim window
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => {
      if (v.currentTime >= (end || v.duration)) {
        v.currentTime = start
        if (!playing) v.pause()
      }
    }
    v.addEventListener('timeupdate', onTime)
    return () => v.removeEventListener('timeupdate', onTime)
  }, [start, end, playing])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (playing) { v.pause(); setPlaying(false) }
    else {
      if (v.currentTime < start || v.currentTime >= end) v.currentTime = start
      v.play().catch(() => {})
      setPlaying(true)
    }
  }, [playing, start, end])

  const setTrim = (which: 'start' | 'end', value: number) => {
    const v = videoRef.current
    if (which === 'start') {
      const s = Math.min(value, end - 0.5)
      setStart(s)
      if (v) v.currentTime = s
    } else {
      const e = Math.max(value, start + 0.5)
      setEnd(e)
      if (v) v.currentTime = Math.max(start, e - 0.5)
    }
  }

  const apply = () => {
    const overlays: Overlay[] = text.trim()
      ? [{
          id: 'quick-text',
          type: 'text',
          content: text.trim(),
          x: 50,
          y: textPos === 'top' ? 14 : textPos === 'middle' ? 50 : 84,
          fontSize: 44,
          color: textColor,
          startTime: start,
          endTime: end,
        }]
      : []
    onComplete({
      clipStart: start,
      clipEnd: end || duration,
      overlays,
      musicTrack: musicId,
      voiceoverBlob: null,
      filters: { ...DEFAULT_FILTERS, preset },
    })
  }

  const openInStudio = async () => {
    if (!file) return
    setHandoff(true)
    try {
      const [{ newProject, defaultClip, uid, DEFAULT_TEXT_STYLE }, { saveAssetBlob, saveProjectLocal }, { probeMediaFile }] = await Promise.all([
        import('@/lib/editor/types'),
        import('@/lib/editor/persist'),
        import('@/lib/editor/import'),
      ])
      const meta = await probeMediaFile(file)
      const project = newProject(file.name.replace(/\.[^.]+$/, ''))
      const asset = { id: uid(), kind: 'video' as const, name: file.name, url: '', duration: meta.duration, width: meta.width, height: meta.height }
      await saveAssetBlob(asset.id, file)
      project.assets.push(asset)
      const videoTrack = project.tracks.find(t => t.kind === 'video')!
      const clip = defaultClip('video', {
        label: file.name,
        assetId: asset.id,
        start: 0,
        duration: Math.max(0.5, (end || meta.duration) - start),
        in: start,
      })
      clip.filters.preset = preset
      videoTrack.clips.push(clip)
      if (text.trim()) {
        const textTrack = project.tracks.find(t => t.kind === 'text')!
        const t = defaultClip('text', {
          label: text.slice(0, 20),
          text: text.trim(),
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 64, color: textColor },
          start: 0,
          duration: Math.max(0.5, (end || meta.duration) - start),
        })
        t.transform.y = textPos === 'top' ? -36 : textPos === 'middle' ? 0 : 34
        textTrack.clips.push(t)
      }
      await saveProjectLocal(project)
      window.location.href = `/studio/editor?project=${project.id}`
    } catch {
      setHandoff(false)
    }
  }

  if (!file) {
    return <div className="p-6 text-center text-sm text-zinc-500">Add a video file above to edit it.</div>
  }

  const filterCss = preset ? PRESET_CSS[preset] : 'none'
  const startPct = duration ? (start / duration) * 100 : 0
  const endPct = duration ? ((end || duration) / duration) * 100 : 100

  return (
    <div className="flex flex-col gap-4 p-4 lg:flex-row">
      {/* preview + trim */}
      <div className="min-w-0 flex-1">
        <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-black">
          <video
            ref={videoRef}
            src={url}
            onLoadedMetadata={onMeta}
            onClick={togglePlay}
            playsInline
            className="mx-auto max-h-[46vh] w-full object-contain"
            style={{ filter: filterCss }}
          />
          {text.trim() && (
            <div
              className="pointer-events-none absolute inset-x-0 px-4 text-center font-bold drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]"
              style={{
                color: textColor,
                fontSize: 'clamp(16px, 4vw, 30px)',
                top: textPos === 'top' ? '8%' : textPos === 'middle' ? '46%' : 'auto',
                bottom: textPos === 'bottom' ? '10%' : 'auto',
              }}
            >
              {text}
            </div>
          )}
          {!playing && (
            <button onClick={togglePlay} className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70" aria-label="Play">
              <Play className="h-6 w-6 translate-x-0.5" />
            </button>
          )}
        </div>

        {/* trim bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span className="font-mono">{fmt(start)}</span>
            <span className="text-zinc-400">Keep {fmt(Math.max(0, (end || duration) - start))}</span>
            <span className="font-mono">{fmt(end || duration)}</span>
          </div>
          <div className="relative mt-1 h-8">
            <div className="absolute inset-y-2 left-0 right-0 rounded-full bg-zinc-800" />
            <div className="absolute inset-y-2 rounded-full bg-emerald-500/40" style={{ left: `${startPct}%`, right: `${100 - endPct}%` }} />
            <input
              type="range" min={0} max={duration || 1} step={0.1} value={start}
              onChange={e => setTrim('start', parseFloat(e.target.value))}
              className="quickedit-range absolute inset-x-0 top-0 h-8 w-full appearance-none bg-transparent"
              aria-label="Trim start"
            />
            <input
              type="range" min={0} max={duration || 1} step={0.1} value={end || duration}
              onChange={e => setTrim('end', parseFloat(e.target.value))}
              className="quickedit-range absolute inset-x-0 top-0 h-8 w-full appearance-none bg-transparent"
              aria-label="Trim end"
            />
          </div>
        </div>
      </div>

      {/* controls */}
      <div className="flex w-full flex-col gap-4 lg:w-80">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500"><Wand2 className="h-3 w-3" /> Filter</p>
          <div className="grid grid-cols-4 gap-1">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => setPreset(p.id)}
                className={`rounded-lg border px-1 py-1.5 text-[10px] ${preset === p.id ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500"><TypeIcon className="h-3 w-3" /> Text</p>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add a caption…"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          />
          {text.trim() && (
            <div className="mt-1.5 flex items-center gap-1.5">
              {(['top', 'middle', 'bottom'] as const).map(p => (
                <button key={p} onClick={() => setTextPos(p)} className={`flex-1 rounded-lg border py-1 text-[10px] capitalize ${textPos === p ? 'border-emerald-500 text-emerald-300' : 'border-zinc-800 text-zinc-400'}`}>{p}</button>
              ))}
              <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-zinc-800 bg-transparent" aria-label="Text color" />
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500"><Music className="h-3 w-3" /> Music</p>
          <select
            value={musicId ?? ''}
            onChange={e => setMusicId(e.target.value || null)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-xs text-white"
          >
            <option value="">No music</option>
            {MUSIC_LIBRARY.map(t => (
              <option key={t.id} value={t.id}>{t.name} · {t.genre} ({t.duration})</option>
            ))}
          </select>
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <button onClick={apply} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-sm font-bold text-black hover:opacity-90">
            <Check className="h-4 w-4" /> Apply edits
          </button>
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-700 py-2 text-xs text-zinc-300 hover:bg-zinc-800">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button onClick={openInStudio} disabled={handoff} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60">
              {handoff ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />} Studio Editor
            </button>
          </div>
          <p className="text-center text-[10px] leading-relaxed text-zinc-600">
            Need multi-track, keyframes, or AI tools? Open this video in the full Studio Editor.
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .quickedit-range { pointer-events: none; }
        .quickedit-range::-webkit-slider-thumb {
          pointer-events: auto; appearance: none; -webkit-appearance: none;
          height: 24px; width: 12px; border-radius: 6px;
          background: #10b981; border: 2px solid #052e22; cursor: ew-resize;
        }
        .quickedit-range::-moz-range-thumb {
          pointer-events: auto; height: 24px; width: 12px; border-radius: 6px;
          background: #10b981; border: 2px solid #052e22; cursor: ew-resize;
        }
      ` }} />
    </div>
  )
}
