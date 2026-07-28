'use client'

// ============================================================
// HapiEats TV Studio — Multi-track Timeline
// Drag to move, edge-drag to trim, click to select, ruler
// scrub, zoom, snapping, split/duplicate/delete, track
// mute/lock/hide, keyframe markers.
// ============================================================

import { useRef, useState, useCallback, MouseEvent as RMouseEvent } from 'react'
import {
  Film, Music, Type as TypeIcon, Volume2, VolumeX, Lock, Unlock, Eye, EyeOff,
  Plus, Scissors, Copy, Trash2, Magnet, ZoomIn, ZoomOut, ChevronUp, ChevronDown,
} from 'lucide-react'
import { useEditor } from '@/lib/editor/store'
import { Track, Clip, projectDuration } from '@/lib/editor/types'
import { usePremium } from './usePremium'

const TL_BTN = 'inline-flex items-center justify-center rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-35 disabled:hover:bg-transparent'
const TK_BTN = 'rounded p-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-white'

const TRACK_H = 56
const HEADER_W = 112
const RULER_H = 28

const KIND_COLOR: Record<string, string> = {
  video: 'from-emerald-600/80 to-emerald-700/80 border-emerald-400/50',
  image: 'from-teal-600/80 to-teal-700/80 border-teal-400/50',
  audio: 'from-violet-600/80 to-violet-700/80 border-violet-400/50',
  text: 'from-orange-500/80 to-orange-600/80 border-orange-300/50',
  sticker: 'from-pink-500/80 to-pink-600/80 border-pink-300/50',
}

type DragState =
  | { mode: 'move'; clipId: string; trackId: string; grabOffset: number }
  | { mode: 'trim-l' | 'trim-r'; clipId: string; trackId: string }
  | { mode: 'scrub' }
  | null

export default function TimelinePanel() {
  const project = useEditor(s => s.project)
  const zoom = useEditor(s => s.zoom)
  const snapping = useEditor(s => s.snapping)
  const currentTime = useEditor(s => s.currentTime)
  const selectedClipId = useEditor(s => s.selectedClipId)
  const { setTime, setZoom, toggleSnapping, select, updateClip, moveClip, updateTrack, addTrack, removeTrack, splitClip, duplicateClip, removeClip, moveTrack } = useEditor()
  const { limits, gate } = usePremium()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState>(null)
  const dragSnapshot = useRef<typeof project | null>(null)

  const duration = Math.max(projectDuration(project), 10)
  const timelineW = duration * zoom + 240

  const timeFromClientX = useCallback((clientX: number) => {
    const el = scrollRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    return Math.max(0, (clientX - rect.left - HEADER_W + el.scrollLeft) / zoom)
  }, [zoom])

  const snap = useCallback((t: number, excludeClipId?: string) => {
    if (!snapping) return t
    const candidates: number[] = [0, currentTime]
    for (const tr of project.tracks) for (const c of tr.clips) {
      if (c.id === excludeClipId) continue
      candidates.push(c.start, c.start + c.duration)
    }
    const threshold = 8 / zoom
    let best = t, bestD = threshold
    for (const c of candidates) {
      const d = Math.abs(c - t)
      if (d < bestD) { best = c; bestD = d }
    }
    return best
  }, [snapping, currentTime, project, zoom])

  // ---------- pointer handlers ----------

  const onMouseMove = useCallback((e: RMouseEvent) => {
    if (!drag) return
    const t = timeFromClientX(e.clientX)
    if (drag.mode === 'scrub') {
      useEditor.setState({ playing: false })
      setTime(t)
      return
    }
    const state = useEditor.getState()
    const track = state.project.tracks.find(tr => tr.id === drag.trackId)
    const clip = track?.clips.find(c => c.id === drag.clipId)
    if (!clip || !track || track.locked) return

    if (drag.mode === 'move') {
      const newStart = snap(Math.max(0, t - drag.grabOffset), clip.id)
      updateClip(clip.id, { start: newStart }, false)
    } else if (drag.mode === 'trim-l') {
      const maxStart = clip.start + clip.duration - 0.15
      const newStart = Math.min(snap(t, clip.id), maxStart)
      const delta = newStart - clip.start
      const newIn = Math.max(0, clip.in + delta * clip.speed)
      updateClip(clip.id, { start: newStart, duration: clip.duration - delta, in: newIn }, false)
    } else if (drag.mode === 'trim-r') {
      const newEnd = Math.max(snap(t, clip.id), clip.start + 0.15)
      updateClip(clip.id, { duration: newEnd - clip.start }, false)
    }
  }, [drag, timeFromClientX, snap, updateClip, setTime])

  const onMouseUp = useCallback(() => {
    if (drag && drag.mode !== 'scrub' && dragSnapshot.current) {
      // commit the whole gesture as one undo step
      const s = useEditor.getState()
      useEditor.setState({ past: [...s.past, dragSnapshot.current], future: [] })
    }
    dragSnapshot.current = null
    setDrag(null)
  }, [drag])

  const startClipDrag = useCallback((e: RMouseEvent, track: Track, clip: Clip) => {
    e.stopPropagation()
    select(clip.id, track.id)
    if (track.locked) return
    dragSnapshot.current = useEditor.getState().project
    const t = timeFromClientX(e.clientX)
    const edge = 8 / zoom
    if (t - clip.start < edge) setDrag({ mode: 'trim-l', clipId: clip.id, trackId: track.id })
    else if (clip.start + clip.duration - t < edge) setDrag({ mode: 'trim-r', clipId: clip.id, trackId: track.id })
    else setDrag({ mode: 'move', clipId: clip.id, trackId: track.id, grabOffset: t - clip.start })
  }, [select, timeFromClientX, zoom])

  // ---------- toolbar actions ----------

  const selClip = selectedClipId
  const doSplit = () => selClip && splitClip(selClip, currentTime)
  const doDup = () => selClip && duplicateClip(selClip)
  const doDelete = () => selClip && removeClip(selClip)

  const handleAddTrack = (kind: Track['kind']) => {
    const count = project.tracks.filter(t => t.kind === kind).length
    if (kind === 'video' && count >= limits.maxVideoTracks) {
      if (!gate('Multi-track editing')) return
    }
    if (kind === 'audio' && count >= limits.maxAudioTracks) {
      if (!gate('Extra audio tracks')) return
    }
    addTrack(kind)
  }

  // ---------- render ----------

  const ticks: number[] = []
  const step = zoom >= 120 ? 1 : zoom >= 50 ? 2 : zoom >= 20 ? 5 : 10
  for (let t = 0; t <= duration + step; t += step) ticks.push(t)

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/80">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800/80 px-2 py-1.5">
        <button onClick={doSplit} disabled={!selClip} className={TL_BTN} title="Split at playhead (S)"><Scissors className="h-4 w-4" /></button>
        <button onClick={doDup} disabled={!selClip} className={TL_BTN} title="Duplicate"><Copy className="h-4 w-4" /></button>
        <button onClick={doDelete} disabled={!selClip} className={`${TL_BTN} text-red-400`} title="Delete (Del)"><Trash2 className="h-4 w-4" /></button>
        <div className="mx-1 h-5 w-px bg-zinc-800" />
        <button onClick={toggleSnapping} className={`${TL_BTN} ${snapping ? 'bg-zinc-800 text-emerald-400' : ''}`} title="Snapping"><Magnet className="h-4 w-4" /></button>
        <button onClick={() => setZoom(zoom / 1.4)} className={TL_BTN} title="Zoom out"><ZoomOut className="h-4 w-4" /></button>
        <button onClick={() => setZoom(zoom * 1.4)} className={TL_BTN} title="Zoom in"><ZoomIn className="h-4 w-4" /></button>
        <div className="mx-1 h-5 w-px bg-zinc-800" />
        <button onClick={() => handleAddTrack('video')} className={`${TL_BTN} gap-1 text-[11px]`} title="Add video track"><Plus className="h-3.5 w-3.5" /><Film className="h-3.5 w-3.5" /></button>
        <button onClick={() => handleAddTrack('audio')} className={`${TL_BTN} gap-1 text-[11px]`} title="Add audio track"><Plus className="h-3.5 w-3.5" /><Music className="h-3.5 w-3.5" /></button>
        <button onClick={() => handleAddTrack('text')} className={`${TL_BTN} gap-1 text-[11px]`} title="Add text track"><Plus className="h-3.5 w-3.5" /><TypeIcon className="h-3.5 w-3.5" /></button>
      </div>

      {/* scrollable timeline */}
      <div
        ref={scrollRef}
        className="relative flex-1 select-none overflow-auto"
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div style={{ width: timelineW + HEADER_W, minHeight: '100%' }}>
          {/* ruler */}
          <div
            className="sticky top-0 z-20 flex cursor-pointer bg-zinc-950/95"
            style={{ height: RULER_H }}
            onMouseDown={(e) => { setDrag({ mode: 'scrub' }); useEditor.setState({ playing: false }); setTime(timeFromClientX(e.clientX)) }}
          >
            <div className="sticky left-0 z-30 shrink-0 border-r border-b border-zinc-800 bg-zinc-950" style={{ width: HEADER_W }} />
            <div className="relative flex-1 border-b border-zinc-800">
              {ticks.map(t => (
                <div key={t} className="absolute top-0 h-full border-l border-zinc-800/80 pl-1 font-mono text-[9px] leading-6 text-zinc-500" style={{ left: t * zoom }}>
                  {t % 60 === 0 ? `${Math.floor(t / 60)}:00` : `${t % 60}s`}
                </div>
              ))}
            </div>
          </div>

          {/* tracks */}
          {project.tracks.map((track, ti) => (
            <div key={track.id} className="flex" style={{ height: TRACK_H }}>
              {/* header */}
              <div className="sticky left-0 z-10 flex shrink-0 flex-col justify-center gap-0.5 border-r border-b border-zinc-800/80 bg-zinc-950 px-2" style={{ width: HEADER_W }}>
                <div className="flex items-center gap-1 text-[10px] font-semibold text-zinc-300">
                  {track.kind === 'video' ? <Film className="h-3 w-3 text-emerald-400" /> : track.kind === 'audio' ? <Music className="h-3 w-3 text-violet-400" /> : <TypeIcon className="h-3 w-3 text-orange-400" />}
                  <span className="truncate">{track.label}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => updateTrack(track.id, { muted: !track.muted })} className={TK_BTN} title="Mute">
                    {track.muted ? <VolumeX className="h-3 w-3 text-red-400" /> : <Volume2 className="h-3 w-3" />}
                  </button>
                  <button onClick={() => updateTrack(track.id, { hidden: !track.hidden })} className={TK_BTN} title="Hide">
                    {track.hidden ? <EyeOff className="h-3 w-3 text-red-400" /> : <Eye className="h-3 w-3" />}
                  </button>
                  <button onClick={() => updateTrack(track.id, { locked: !track.locked })} className={TK_BTN} title="Lock">
                    {track.locked ? <Lock className="h-3 w-3 text-amber-400" /> : <Unlock className="h-3 w-3" />}
                  </button>
                  <button onClick={() => moveTrack(track.id, -1)} className={TK_BTN} title="Move up"><ChevronUp className="h-3 w-3" /></button>
                  <button onClick={() => moveTrack(track.id, 1)} className={TK_BTN} title="Move down"><ChevronDown className="h-3 w-3" /></button>
                  {project.tracks.length > 1 && (
                    <button onClick={() => removeTrack(track.id)} className={TK_BTN} title="Remove track"><Trash2 className="h-3 w-3 text-red-500/70" /></button>
                  )}
                </div>
              </div>

              {/* lane */}
              <div
                className={`relative flex-1 border-b border-zinc-800/60 ${ti % 2 ? 'bg-zinc-900/30' : 'bg-zinc-900/10'}`}
                onMouseDown={(e) => {
                  // click empty lane = scrub + deselect
                  select(null)
                  setDrag({ mode: 'scrub' })
                  useEditor.setState({ playing: false })
                  setTime(timeFromClientX(e.clientX))
                }}
              >
                {track.clips.map(clip => {
                  const selected = clip.id === selectedClipId
                  const kfCount = Object.values(clip.keyframes).reduce((n, arr) => n + (arr?.length || 0), 0)
                  return (
                    <div
                      key={clip.id}
                      onMouseDown={(e) => startClipDrag(e, track, clip)}
                      className={`absolute top-1 bottom-1 cursor-grab overflow-hidden rounded-lg border bg-gradient-to-b px-2 py-1 ${KIND_COLOR[clip.kind] || KIND_COLOR.video} ${selected ? 'ring-2 ring-white shadow-lg z-10' : 'opacity-90 hover:opacity-100'}`}
                      style={{ left: clip.start * zoom, width: Math.max(10, clip.duration * zoom) }}
                      title={clip.label}
                    >
                      <div className="truncate text-[10px] font-semibold text-white/95">{clip.label}</div>
                      <div className="flex items-center gap-1 text-[9px] text-white/70">
                        {clip.speed !== 1 && <span className="rounded bg-black/30 px-1">{clip.speed}x</span>}
                        {clip.transitionIn.type !== 'none' && <span className="rounded bg-black/30 px-1">↪ {clip.transitionIn.type}</span>}
                        {clip.removeBackground && <span className="rounded bg-black/30 px-1">AI bg</span>}
                        {kfCount > 0 && <span className="rounded bg-black/30 px-1">◆ {kfCount}</span>}
                      </div>
                      {/* keyframe markers */}
                      {Object.values(clip.keyframes).flatMap(arr => arr || []).map((kf, i) => (
                        <span key={i} className="pointer-events-none absolute bottom-0.5 h-1.5 w-1.5 rotate-45 bg-white/90" style={{ left: kf.t * zoom - 3 }} />
                      ))}
                      {/* trim handles */}
                      <span className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-white/30 opacity-0 hover:opacity-100" />
                      <span className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-white/30 opacity-0 hover:opacity-100" />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* playhead */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-red-500"
            style={{ left: HEADER_W + currentTime * zoom }}
          >
            <div className="absolute -left-[5px] top-0 h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-red-500" />
          </div>
        </div>
      </div>

    </div>
  )
}
