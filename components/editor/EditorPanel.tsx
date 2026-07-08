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

  return preview ? (
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
  ) : (
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
        {/* ─── TOP: Video Preview (flexible height) ─── */}
        <div className="flex-1 min-h-0 bg-black/90 relative flex items-center justify-center overflow-hidden">
          {vu ? (
            <>
              <video ref={vr} src={vu}
                className="w-full h-full object-contain"
                onLoadedMetadata={onMeta}
                onTimeUpdate={() => { try { if (vr.current) setCt(vr.current.currentTime) } catch {} }}
                onPlay={() => setPlay(true)} onPause={() => setPlay(false)} onEnded={() => setPlay(false)}
                playsInline />
              {!play && (
                <div className="absolute inset-0 flex items-center justify-center" onClick={toggle}>
                  <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-2xl hover:bg-white/30 transition-all cursor-pointer">
                    <Play className="h-8 w-8 text-white ml-1" />
                  </div>
                </div>
              )}
              {/* Time badge bottom-right */}
              <div className="absolute bottom-3 right-3 bg-black/70 rounded-lg px-3 py-1.5 text-sm text-white/90 font-mono">
                {Math.floor(ct / 60)}:{(Math.floor(ct) % 60).toString().padStart(2, '0')} / {Math.floor((ce || dur) / 60)}:{(Math.floor(ce || dur) % 60).toString().padStart(2, '0')}
              </div>
              {/* Edit badges */}
              {hasEdits && (
                <div className="absolute top-3 left-3 flex gap-1.5">
                  {ov.length > 0 && <span className="text-xs px-2 py-1 rounded-full bg-primary/90 text-white font-medium">{ov.length} TX</span>}
                  {sel && <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/90 text-white font-medium">MU</span>}
                  {vb && <span className="text-xs px-2 py-1 rounded-full bg-amber-500/90 text-white font-medium">VO</span>}
                  {fl.preset && <span className="text-xs px-2 py-1 rounded-full bg-purple-500/90 text-white font-medium capitalize">{fl.preset}</span>}
                </div>
              )}
            </>
          ) : (
            <div className="text-zinc-600">Loading...</div>
          )}
          {/* Done top-right */}
          <button onClick={done}
            className="absolute top-3 right-3 px-5 py-2 rounded-lg bg-gradient-to-r from-primary to-orange-500 text-white text-sm font-semibold shadow-lg hover:shadow-primary/30 active:scale-[0.97] transition-all z-10">
            <Check className="h-4 w-4 inline mr-1.5" />Done
          </button>
        </div>

        {/* ─── MIDDLE: Tool tabs (horizontal, scrollable) ─── */}
        <div className="shrink-0 px-2 py-2 bg-zinc-900/90 border-t border-white/5">
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {TABS.map(id => {
              const I = TI[id]
              return (
                <button key={id} onClick={() => setTab(id)}
                  className={cn('flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all min-w-[72px]', tab === id ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-zinc-400 border border-transparent hover:text-zinc-200 hover:bg-white/10')}>
                  <I className="h-5 w-5" />
                  <span>{TL[id]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── Tool content (expands when a tool is selected) ─── */}
        <div className={cn('overflow-y-auto bg-zinc-900/50 border-t border-white/5 transition-all', tab !== 'trim' ? 'min-h-[200px] max-h-[280px]' : 'min-h-[100px] max-h-[180px]')}>
          <div className="p-4">
            {tab === 'trim' && <TrimPanel file={files[0]} clipStart={cs} clipEnd={ce} onTrimChange={(s, e) => { setCs(s); setCe(e) }} />}
            {tab === 'text' && <TextOverlayPanel overlays={ov} onOverlaysChange={setOv} videoDuration={dur} />}
            {tab === 'music' && <MusicPanel selectedTrack={sel} onTrackSelect={setSel} />}
            {tab === 'voice' && <VoiceOverPanel blob={vb} onBlobChange={setVb} />}
            {tab === 'stickers' && <StickerPanel overlays={ov} onOverlaysChange={setOv} videoDuration={dur} />}
            {tab === 'filters' && <FilterPanel filters={fl} onFiltersChange={setFl} videoUrl={vu || ''} />}
          </div>
        </div>

        {/* ─── BOTTOM: Timeline strip ─── */}
        <div className="shrink-0 h-24 bg-zinc-950 border-t border-white/5">
          <div className="w-full h-full overflow-x-auto overflow-y-hidden scrollbar-none">
            <div className="min-w-[500px] h-full p-1">
              <Timeline tracks={tracks} duration={ce || dur} currentTime={ct} onSeek={seek} onDeleteClip={del} onSelectClip={selClip} zoom={zm} onZoomChange={setZm} />
            </div>
          </div>
        </div>

        {/* ─── BOTTOM ACTION BAR: CapCut-style buttons ─── */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-t border-white/5">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
            <button onClick={add} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-zinc-300 text-sm hover:bg-white/20 transition-all whitespace-nowrap">
              <Plus className="h-4 w-4" /> Add
            </button>
            <div className="w-px h-5 bg-zinc-700" />
            <button onClick={() => setPreview(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-400 text-sm hover:bg-white/10 hover:text-zinc-200 transition-all whitespace-nowrap">
              <Eye className="h-4 w-4" /> Preview
            </button>
            <div className="w-px h-5 bg-zinc-700" />
            <button onClick={onCancel} className="text-zinc-500 text-sm hover:text-zinc-300 transition-colors whitespace-nowrap">Cancel</button>
          </div>
          <button onClick={done} className="px-6 py-2 rounded-lg bg-gradient-to-r from-primary to-orange-500 text-white text-sm font-semibold shadow-lg hover:shadow-primary/30 active:scale-[0.97] transition-all">
            <Check className="h-4 w-4 inline mr-1.5" />Done
          </button>
        </div>
      </div>
    </div>
  )
}
