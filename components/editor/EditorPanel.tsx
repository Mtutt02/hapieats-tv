'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Scissors, Type, Music, Mic, Sticker, Palette,
  Plus, Check, X, Play, Pause, Eye, Film, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import TrimPanel from './TrimPanel'
import TextOverlayPanel from './TextOverlayPanel'
import MusicPanel from './MusicPanel'
import VoiceOverPanel from './VoiceOverPanel'
import StickerPanel from './StickerPanel'
import FilterPanel from './FilterPanel'
import Timeline from './Timeline'
import type { EditorOutput, Overlay, FilterSettings, TimelineTrack, TimelineClip, VideoClip } from './types'
import { DEFAULT_FILTERS } from './types'

interface Props {
  files: File[]
  onComplete: (output: EditorOutput) => void
  onCancel: () => void
  showTutorial?: boolean
  onDismissTutorial?: () => void
}

type TabId = 'trim' | 'text' | 'music' | 'voice' | 'stickers' | 'filters'
const TABS: TabId[] = ['trim', 'text', 'music', 'voice', 'stickers', 'filters']
const TI: Record<TabId, React.ElementType> = { trim: Scissors, text: Type, music: Music, voice: Mic, stickers: Sticker, filters: Palette }
const TL: Record<TabId, string> = { trim: 'Trim', text: 'Text', music: 'Music', voice: 'Voice', stickers: 'Stickers', filters: 'Filters' }

function buildTracks(overlays: Overlay[], sel: string | null, vb: Blob | null, cs: number, ce: number, clips: VideoClip[]): TimelineTrack[] {
  const t: TimelineTrack[] = []
  const vc: TimelineClip[] = clips.length > 0
    ? clips.map(c => ({ id: c.id, type: 'video' as const, label: c.file?.name || 'Clip', startTime: c.startTime || 0, endTime: c.endTime || ce, data: c }))
    : (ce > 0 ? [{ id: 'main-video', type: 'video' as const, label: 'Main', startTime: cs, endTime: ce }] : [])
  if (vc.length > 0) t.push({ id: 'track-v', label: 'Video', type: 'video', icon: '🎬', clips: vc, color: '#3b82f6' })
  const oc = overlays.map(o => ({ id: o.id, type: 'overlay' as const, label: `${o.type === 'text' ? '📝' : '🎨'} ${o.content.substring(0, 15)}`, startTime: o.startTime, endTime: o.endTime }))
  if (oc.length > 0) t.push({ id: 'track-o', label: 'Overlays', type: 'overlay', icon: '🎨', clips: oc, color: '#a855f7' })
  if (sel) t.push({ id: 'track-m', label: 'Music', type: 'music', icon: '🎵', clips: [{ id: 'mc', type: 'music' as const, label: 'Background Music', startTime: cs, endTime: ce }], color: '#22c55e' })
  if (vb) t.push({ id: 'track-vc', label: 'Voice', type: 'voice', icon: '🎤', clips: [{ id: 'vc', type: 'voice' as const, label: 'Voiceover', startTime: cs, endTime: ce }], color: '#f59e0b' })
  return t
}

export default function EditorPanel({ files, onComplete, onCancel, showTutorial, onDismissTutorial }: Props) {
  const vr = useRef<HTMLVideoElement>(null)
  const [vu, setVu] = useState<string | null>(null)
  const [clips, setClips] = useState<VideoClip[]>([])
  const [ct, setCt] = useState(0)
  const [dur, setDur] = useState(0)
  const [play, setPlay] = useState(false)
  const [cs, setCs] = useState(0)
  const [ce, setCe] = useState(0)
  const [tab, setTab] = useState<TabId>('trim')
  const [ov, setOv] = useState<Overlay[]>([])
  const [fl, setFl] = useState<FilterSettings>(DEFAULT_FILTERS)
  const [sel, setSel] = useState<string | null>(null)
  const [vb, setVb] = useState<Blob | null>(null)
  const [zm, setZm] = useState(1)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    const ic = files.map((f, i) => ({ id: `c${i + 1}`, file: f, url: URL.createObjectURL(f), startTime: 0, endTime: 0 }))
    setClips(ic); setVu(ic[0]?.url || null)
    return () => ic.forEach(c => URL.revokeObjectURL(c.url))
  }, [files])

  const onMeta = () => { if (vr.current) { const d = vr.current.duration; if (isFinite(d)) { setDur(d); if (ce === 0) setCe(d) } } }

  const toggle = () => {
    if (!vr.current) return
    if (play) { vr.current.pause(); setPlay(false) } else {
      if (vr.current.currentTime >= ce || vr.current.currentTime < cs) vr.current.currentTime = cs
      vr.current.play().then(() => setPlay(true)).catch(() => {})
    }
  }

  const seek = (t: number) => { try { if (vr.current) vr.current.currentTime = t; setCt(t) } catch {} }

  const del = (tid: string, cid: string) => {
    const o = ov.find(x => x.id === cid)
    if (o) { setOv(prev => prev.filter(x => x.id !== cid)); return }
    if (cid === 'mc') { setSel(null); return }
    if (cid === 'vc') { setVb(null); return }
  }

  const add = () => {
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = 'video/*'
    inp.onchange = () => {
      const f = inp.files?.[0]
      if (!f) return
      const url = URL.createObjectURL(f)
      setClips(p => [...p, { id: `c${p.length + 1}-${Date.now()}`, file: f, url, startTime: 0, endTime: 0 }])
      setVu(url); setCs(0); setCe(0); setCt(0); setDur(0)
    }
    inp.click()
  }

  const selClip = (id: string) => {
    const c = clips.find(x => x.id === id)
    if (c?.url) { setVu(c.url); setCs(0); setCe(0); setCt(0); setDur(0); setPlay(false) }
  }

  const done = () => onComplete({ clipStart: cs, clipEnd: ce, overlays: ov, musicTrack: sel, voiceoverBlob: vb, filters: fl })

  const tracks = buildTracks(ov, sel, vb, cs, ce, clips)
  const hasEdits = ov.length > 0 || sel || vb || fl.preset

  // Full-screen preview mode
  if (preview) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex-1 relative flex items-center justify-center">
          <video ref={vr} src={vu || ''} className="max-w-full max-h-full object-contain" autoPlay loop playsInline />
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
          <button onClick={() => setPreview(false)}
            className="px-6 py-3 rounded-xl bg-white/10 backdrop-blur-md text-white text-sm font-medium border border-white/20 hover:bg-white/20 transition-all">
            Back to Editor
          </button>
          <button onClick={done}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-orange-500 text-white text-sm font-semibold shadow-lg">
            <Check className="h-4 w-4 inline mr-1.5" />Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Tutorial */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="max-w-sm w-full">
            <div className="text-center mb-8">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
                <Film className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">CapCut-style Editor</h2>
              <p className="text-zinc-400 text-sm mt-1">Edit in 4 steps</p>
            </div>
            <div className="space-y-3">
              {[
                ['Trim & Cut', 'Adjust clip start and end.'],
                ['Effects', 'Add text, music, filters, stickers.'],
                ['Preview', 'Tap the eye icon to watch your edit.'],
                ['Done', 'Publish when it looks good.'],
              ].map(([s, d], i) => (
                <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                  <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</div>
                  <div><p className="text-white font-medium text-sm">{s}</p><p className="text-zinc-500 text-xs">{d}</p></div>
                </div>
              ))}
            </div>
            <button onClick={onDismissTutorial}
              className="w-full mt-8 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-[0.98] transition-all">
              Start editing
            </button>
          </div>
        </div>
      )}

      {/* === CAPCUT-STYLE LAYOUT === */}
      <div className="h-full flex flex-col bg-[#0a0a0f] overflow-hidden">
        {/* ─── TOP: Preview panel ─── */}
        <div className="flex-shrink-0 flex items-center justify-center bg-black/40 border-b border-white/5" style={{ height: '40%', minHeight: 200 }}>
          <div className="relative w-full h-full flex items-center justify-center">
            {vu ? (
              <>
                <video ref={vr} src={vu}
                  className="max-w-full max-h-full object-contain"
                  onLoadedMetadata={onMeta}
                  onTimeUpdate={() => { try { if (vr.current) setCt(vr.current.currentTime) } catch {} }}
                  onPlay={() => setPlay(true)} onPause={() => setPlay(false)} onEnded={() => setPlay(false)}
                  playsInline />
                {!play && (
                  <div className="absolute inset-0 flex items-center justify-center" onClick={toggle}>
                    <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-2xl hover:bg-white/30 transition-all cursor-pointer">
                      <Play className="h-7 w-7 text-white ml-0.5" />
                    </div>
                  </div>
                )}
                {/* Time badge */}
                <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm rounded-lg px-2.5 py-1">
                  <span className="text-xs text-white/80 font-mono">{Math.floor(ct / 60)}:{(Math.floor(ct) % 60).toString().padStart(2, '0')} / {Math.floor((ce || dur) / 60)}:{(Math.floor(ce || dur) % 60).toString().padStart(2, '0')}</span>
                </div>
                {/* Edit badges */}
                {hasEdits && (
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    {ov.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/80 text-white">{ov.length} TX</span>}
                    {sel && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/80 text-white">MU</span>}
                    {vb && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/80 text-white">VO</span>}
                    {fl.preset && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/80 text-white capitalize">{fl.preset}</span>}
                  </div>
                )}
              </>
            ) : (
              <div className="text-zinc-600 text-sm">Loading...</div>
            )}
            {/* Done button top right */}
            <button onClick={done}
              className="absolute top-3 right-3 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-orange-500 text-white text-xs font-semibold shadow-lg hover:shadow-primary/30 active:scale-[0.97] transition-all z-10">
              <Check className="h-3.5 w-3.5 inline mr-1" />Done
            </button>
          </div>
        </div>

        {/* ─── MIDDLE: Tab bar + tool content ─── */}
        <div className="flex-shrink-0">
          {/* Tab bar */}
          <div className="flex gap-0.5 px-2 py-1.5 bg-zinc-900/80 border-b border-white/5">
            {TABS.map(id => {
              const I = TI[id]
              return (
                <button key={id} onClick={() => setTab(id)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all', tab === id ? 'bg-primary/15 text-primary' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5')}>
                  <I className="h-3.5 w-3.5" />
                  <span>{TL[id]}</span>
                </button>
              )
            })}
          </div>

          {/* Tool content panel */}
          <div className="overflow-y-auto" style={{ height: 'clamp(80px, 15vh, 140px)' }}>
            <div className="p-3">
              {tab === 'trim' && <TrimPanel file={files[0]} clipStart={cs} clipEnd={ce} onTrimChange={(s, e) => { setCs(s); setCe(e) }} />}
              {tab === 'text' && <TextOverlayPanel overlays={ov} onOverlaysChange={setOv} videoDuration={dur} />}
              {tab === 'music' && <MusicPanel selectedTrack={sel} onTrackSelect={setSel} />}
              {tab === 'voice' && <VoiceOverPanel blob={vb} onBlobChange={setVb} />}
              {tab === 'stickers' && <StickerPanel overlays={ov} onOverlaysChange={setOv} videoDuration={dur} />}
              {tab === 'filters' && <FilterPanel filters={fl} onFiltersChange={setFl} videoUrl={vu || ''} />}
            </div>
          </div>
        </div>

        {/* ─── BOTTOM: Timeline + actions ─── */}
        <div className="flex-1 flex flex-col min-h-0 border-t border-white/5">
          {/* Timeline */}
          <div className="flex-1 min-h-0 bg-zinc-950/80 overflow-hidden">
            <div className="w-full h-full overflow-x-auto overflow-y-hidden scrollbar-none">
              <div className="min-w-[500px] h-full p-1">
                <Timeline tracks={tracks} duration={ce || dur} currentTime={ct} onSeek={seek} onDeleteClip={del} onSelectClip={selClip} zoom={zm} onZoomChange={setZm} />
              </div>
            </div>
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border-t border-white/5 shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1">Cancel</button>
              <button onClick={add}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-zinc-400 text-xs hover:bg-white/10 hover:text-zinc-200 transition-all">
                <Plus className="h-3 w-3" /> Add Clip
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPreview(true)}
                className={cn('flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all', hasEdits ? 'bg-amber-500/15 text-amber-400' : 'text-zinc-500 hover:text-zinc-300')}>
                <Eye className="h-3.5 w-3.5" /> Preview
              </button>
              <button onClick={done} className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-primary to-orange-500 text-white text-xs font-semibold shadow-lg hover:shadow-primary/30 active:scale-[0.97] transition-all">
                <Check className="h-3.5 w-3.5 inline mr-1" />Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
