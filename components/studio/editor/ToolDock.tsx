'use client'

// ============================================================
// HapiEats TV Studio — Tool Dock
// Media import + library, text & stickers, music & voiceover,
// and the AI suite (auto-captions, smart trim, bg removal).
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Film, Type as TypeIcon, Music, Sparkles, Upload, Clapperboard,
  Mic, Square, Loader2, Wand2, Captions, ScissorsLineDashed, UserRound, Crown, Plus,
} from 'lucide-react'
import { useEditor } from '@/lib/editor/store'
import { MediaAsset, Clip, defaultClip, uid, DEFAULT_TEXT_STYLE } from '@/lib/editor/types'
import { saveAssetBlob } from '@/lib/editor/persist'
import { detectSilence, keepSegments, requestCaptions, fetchCaptionCues } from '@/lib/editor/ai'
import { createClient } from '@/lib/supabase/client'
import { usePremium } from './usePremium'
import { engineRef } from './PreviewPanel'

type Tab = 'media' | 'text' | 'audio' | 'ai'

const STICKERS = ['🔥', '😂', '❤️', '⭐', '🎉', '👨‍🍳', '🍕', '🍔', '🌮', '🍜', '🍰', '☕', '🥑', '🌶️', '🧀', '🥓', '💯', '👏', '😍', '🤤', '✨', '💥', '🏆', '📣']

const TEXT_PRESETS = [
  { label: 'Title', fontSize: 110, y: -20, animation: 'pop' as const },
  { label: 'Subtitle', fontSize: 64, y: 0, animation: 'slide-up' as const },
  { label: 'Caption', fontSize: 48, y: 35, animation: 'none' as const, background: 'rgba(0,0,0,0.65)' },
  { label: 'Lower third', fontSize: 54, y: 32, animation: 'slide-up' as const, background: 'rgba(16,185,129,0.85)' },
]

async function probeFile(file: File): Promise<{ kind: MediaAsset['kind']; duration: number; width?: number; height?: number }> {
  const url = URL.createObjectURL(file)
  try {
    if (file.type.startsWith('image/')) {
      const img = new Image()
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('bad image')); img.src = url })
      return { kind: 'image', duration: 5, width: img.naturalWidth, height: img.naturalHeight }
    }
    const isAudio = file.type.startsWith('audio/')
    const el = document.createElement(isAudio ? 'audio' : 'video') as HTMLVideoElement
    el.preload = 'metadata'
    await new Promise<void>((res, rej) => { el.onloadedmetadata = () => res(); el.onerror = () => rej(new Error('bad media')); el.src = url })
    return {
      kind: isAudio ? 'audio' : 'video',
      duration: el.duration || 5,
      width: (el as HTMLVideoElement).videoWidth || undefined,
      height: (el as HTMLVideoElement).videoHeight || undefined,
    }
  } finally {
    /* keep url — asset will reuse it */
  }
}

export default function ToolDock() {
  const [tab, setTab] = useState<Tab>('media')
  const tabs: { id: Tab; icon: typeof Film; label: string }[] = [
    { id: 'media', icon: Clapperboard, label: 'Media' },
    { id: 'text', icon: TypeIcon, label: 'Text' },
    { id: 'audio', icon: Music, label: 'Audio' },
    { id: 'ai', icon: Sparkles, label: 'AI' },
  ]
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex border-b border-zinc-800/80">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${tab === t.id ? 'border-b-2 border-emerald-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'media' && <MediaTab />}
        {tab === 'text' && <TextTab />}
        {tab === 'audio' && <AudioTab />}
        {tab === 'ai' && <AiTab />}
      </div>
    </div>
  )
}

// ---------------- shared helpers ----------------

function useAddClipToTimeline() {
  const { addClip, addTrack } = useEditor()
  return useCallback((clip: Clip, kind: 'video' | 'audio' | 'text') => {
    const s = useEditor.getState()
    const at = s.currentTime
    clip.start = at
    // find a track of the right kind with free space at the playhead
    const fits = (trackClips: Clip[]) => !trackClips.some(c => at < c.start + c.duration && at + clip.duration > c.start)
    let target = s.project.tracks.find(t => t.kind === kind && !t.locked && fits(t.clips))
    if (!target) target = addTrack(kind)
    addClip(target.id, clip)
    s.select(clip.id, target.id)
  }, [addClip, addTrack])
}

// ---------------- Media ----------------

function MediaTab() {
  const assets = useEditor(s => s.project.assets)
  const { addAsset } = useEditor()
  const addToTimeline = useAddClipToTimeline()
  const inputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [library, setLibrary] = useState<Array<{ id: string; title: string; mux_playback_id: string | null; mux_asset_id: string | null; duration: number | null }>>([])
  const [libLoaded, setLibLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const importFiles = useCallback(async (files: FileList | File[]) => {
    setImporting(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const meta = await probeFile(file)
        const asset: MediaAsset = {
          id: uid(),
          kind: meta.kind,
          name: file.name,
          url: URL.createObjectURL(file),
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
        }
        await saveAssetBlob(asset.id, file)
        addAsset(asset)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }, [addAsset])

  const loadLibrary = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('videos')
        .select('id, title, mux_playback_id, mux_asset_id, duration')
        .eq('creator_id', user.id)
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
        .limit(30)
      setLibrary(data || [])
    } catch { /* library unavailable */ }
    setLibLoaded(true)
  }, [])

  useEffect(() => { loadLibrary() }, [loadLibrary])

  const addAssetClip = (asset: MediaAsset) => {
    const kind = asset.kind === 'audio' ? 'audio' : 'video'
    const clip = defaultClip(asset.kind === 'image' ? 'image' : kind, {
      label: asset.name,
      assetId: asset.id,
      duration: asset.kind === 'image' ? 5 : asset.duration,
    })
    addToTimeline(clip, kind)
  }

  const addLibraryVideo = (v: typeof library[number]) => {
    if (!v.mux_playback_id) return
    const remoteUrl = `https://stream.mux.com/${v.mux_playback_id}/capped-1080p.mp4`
    const asset: MediaAsset = {
      id: uid(),
      kind: 'video',
      name: v.title,
      url: remoteUrl,
      remoteUrl,
      duration: v.duration || 30,
      muxAssetId: v.mux_asset_id || undefined,
      muxPlaybackId: v.mux_playback_id,
    }
    useEditor.getState().addAsset(asset)
    const clip = defaultClip('video', { label: v.title, assetId: asset.id, duration: asset.duration })
    addToTimeline(clip, 'video')
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); importFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-zinc-700 py-6 text-zinc-400 transition hover:border-emerald-500/60 hover:text-zinc-200"
      >
        {importing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
        <span className="text-xs font-medium">Drop video, image, or audio</span>
        <span className="text-[10px] text-zinc-600">or tap to browse</span>
        <input ref={inputRef} type="file" hidden multiple accept="video/*,image/*,audio/*" onChange={e => e.target.files && importFiles(e.target.files)} />
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}

      {assets.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">Project media</p>
          <div className="space-y-1">
            {assets.map(a => (
              <button
                key={a.id}
                onClick={() => addAssetClip(a)}
                className="flex w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-left hover:border-emerald-500/50"
                title="Add to timeline at playhead"
              >
                {a.kind === 'audio' ? <Music className="h-4 w-4 shrink-0 text-violet-400" /> : <Film className="h-4 w-4 shrink-0 text-emerald-400" />}
                <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-200">{a.name}</span>
                <span className="font-mono text-[10px] text-zinc-500">{Math.round(a.duration)}s</span>
                <Plus className="h-3.5 w-3.5 text-zinc-500" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">Your uploads (library)</p>
        {!libLoaded ? (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
        ) : library.length === 0 ? (
          <p className="text-[11px] text-zinc-600">No ready videos in your library yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {library.map(v => (
              <button
                key={v.id}
                onClick={() => addLibraryVideo(v)}
                className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60 text-left hover:border-emerald-500/50"
              >
                {v.mux_playback_id && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`https://image.mux.com/${v.mux_playback_id}/thumbnail.jpg?width=320&time=1`} alt="" className="aspect-video w-full object-cover" loading="lazy" />
                )}
                <span className="block truncate px-1.5 py-1 text-[10px] text-zinc-300">{v.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- Text & stickers ----------------

function TextTab() {
  const addToTimeline = useAddClipToTimeline()

  const addText = (preset: typeof TEXT_PRESETS[number]) => {
    const clip = defaultClip('text', {
      label: preset.label,
      text: preset.label === 'Lower third' ? 'Chef Name\nHapiEats TV' : 'Tap to edit',
      textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: preset.fontSize, animation: preset.animation, background: (preset as any).background || null },
      duration: 4,
    })
    clip.transform.y = preset.y
    addToTimeline(clip, 'text')
  }

  const addSticker = (emoji: string) => {
    const clip = defaultClip('sticker', {
      label: emoji,
      text: emoji,
      textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 140, outline: false, animation: 'pop' },
      duration: 3,
    })
    addToTimeline(clip, 'text')
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">Text styles</p>
        <div className="space-y-1.5">
          {TEXT_PRESETS.map(p => (
            <button key={p.label} onClick={() => addText(p)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left text-sm font-bold text-white hover:border-emerald-500/50" style={{ fontSize: Math.min(18, p.fontSize / 5) }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">Stickers</p>
        <div className="grid grid-cols-6 gap-1">
          {STICKERS.map(s => (
            <button key={s} onClick={() => addSticker(s)} className="rounded-lg border border-zinc-800 bg-zinc-900/60 py-1.5 text-xl hover:border-emerald-500/50">
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------- Audio ----------------

function AudioTab() {
  const addToTimeline = useAddClipToTimeline()
  const { addAsset } = useEditor()
  const inputRef = useRef<HTMLInputElement>(null)
  const [tracks, setTracks] = useState<Array<{ name: string; url: string }>>([])
  const [rec, setRec] = useState<'idle' | 'recording' | 'stopped'>('idle')
  const recorderRef = useRef<{ stop: () => Promise<Blob | null> } | null>(null)

  useEffect(() => {
    import('@/components/studio/audio-utils').then(m => {
      setTracks((m.BUILTIN_TRACKS as Array<{ name: string; url: string }>) || [])
    }).catch(() => {})
  }, [])

  const importAudio = async (fileOrUrl: File | { name: string; url: string }) => {
    let asset: MediaAsset
    if (fileOrUrl instanceof File) {
      const meta = await probeFile(fileOrUrl)
      asset = { id: uid(), kind: 'audio', name: fileOrUrl.name, url: URL.createObjectURL(fileOrUrl), duration: meta.duration }
      await saveAssetBlob(asset.id, fileOrUrl)
    } else {
      const el = document.createElement('audio')
      el.preload = 'metadata'
      await new Promise<void>(res => { el.onloadedmetadata = () => res(); el.onerror = () => res(); el.src = fileOrUrl.url })
      asset = { id: uid(), kind: 'audio', name: fileOrUrl.name, url: fileOrUrl.url, remoteUrl: fileOrUrl.url, duration: el.duration || 30 }
    }
    addAsset(asset)
    const clip = defaultClip('audio', { label: asset.name, assetId: asset.id, duration: Math.min(asset.duration, 60), fadeIn: 0.5, fadeOut: 1, volume: 0.6 })
    addToTimeline(clip, 'audio')
  }

  const startRec = async () => {
    try {
      const m = await import('@/components/studio/audio-utils')
      const r = m.createVoiceoverRecorder(() => {})
      recorderRef.current = r as any
      await (r as any).start()
      setRec('recording')
    } catch {
      alert('Microphone access denied')
    }
  }

  const stopRec = async () => {
    const r = recorderRef.current
    if (!r) return
    const blob = await r.stop()
    setRec('idle')
    if (!blob) return
    const file = new File([blob], `Voiceover ${new Date().toLocaleTimeString()}.webm`, { type: blob.type })
    await importAudio(file)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => inputRef.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 py-2 text-[11px] text-zinc-300 hover:border-emerald-500/50">
          <Upload className="h-3.5 w-3.5" /> Upload audio
        </button>
        <button
          onClick={rec === 'recording' ? stopRec : startRec}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-[11px] ${rec === 'recording' ? 'border-red-500 bg-red-500/10 text-red-300 animate-pulse' : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-emerald-500/50'}`}
        >
          {rec === 'recording' ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          {rec === 'recording' ? 'Stop' : 'Voiceover'}
        </button>
        <input ref={inputRef} type="file" hidden accept="audio/*" onChange={e => e.target.files?.[0] && importAudio(e.target.files[0])} />
      </div>
      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">Music library</p>
        {tracks.length === 0 ? (
          <p className="text-[11px] text-zinc-600">Built-in tracks unavailable.</p>
        ) : (
          <div className="space-y-1">
            {tracks.map(t => (
              <button key={t.name} onClick={() => importAudio(t)} className="flex w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-left hover:border-emerald-500/50">
                <Music className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                <span className="flex-1 truncate text-[11px] text-zinc-200">{t.name}</span>
                <Plus className="h-3.5 w-3.5 text-zinc-500" />
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-[10px] leading-relaxed text-zinc-600">
        Tip: overlap two audio clips and add fade-out + fade-in for a crossfade. Fine-tune with the volume envelope in the inspector.
      </p>
    </div>
  )
}

// ---------------- AI suite ----------------

function AiTab() {
  const { limits, gate } = usePremium()
  const project = useEditor(s => s.project)
  const selectedClipId = useEditor(s => s.selectedClipId)
  const { updateClip } = useEditor()
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const selected = (() => {
    for (const t of project.tracks) {
      const c = t.clips.find(c => c.id === selectedClipId)
      if (c) return { track: t, clip: c }
    }
    return null
  })()

  const selectedVideo = selected?.clip.kind === 'video' ? selected : null
  const selectedAsset = selectedVideo ? project.assets.find(a => a.id === selectedVideo.clip.assetId) : null

  // ---- smart trim ----
  const smartTrim = async () => {
    if (!limits.ai) { gate('Smart Trim'); return }
    if (!selectedVideo || !selectedAsset) { setStatus('Select a video clip first'); return }
    setBusy('trim')
    setStatus('Analyzing audio for silence…')
    try {
      const { getAssetBlob } = await import('@/lib/editor/persist')
      const blob = await getAssetBlob(selectedAsset.id)
      const source = blob ? new File([blob], selectedAsset.name) : selectedAsset.url
      const { silences } = await detectSilence(source)
      const clip = selectedVideo.clip
      // silences within the visible clip window (source time → clip-local)
      const localSilences = silences
        .map(s => ({ start: (s.start - clip.in) / clip.speed, end: (s.end - clip.in) / clip.speed }))
        .filter(s => s.end > 0.1 && s.start < clip.duration - 0.1)
        .map(s => ({ start: Math.max(0.05, s.start), end: Math.min(clip.duration - 0.05, s.end) }))
      if (localSilences.length === 0) {
        setStatus('No silent sections found — clip is already tight.')
        return
      }
      const keeps = keepSegments(clip.duration, localSilences)
      // rebuild: replace the clip with keep-segments packed back-to-back
      const state = useEditor.getState()
      let cursor = clip.start
      const trackId = selected!.track.id
      const newClips = keeps.map(seg => {
        const c = defaultClip('video', {
          label: clip.label,
          assetId: clip.assetId,
          start: cursor,
          duration: seg.end - seg.start,
          in: clip.in + seg.start * clip.speed,
          speed: clip.speed,
        })
        c.filters = { ...clip.filters }
        c.transform = { ...clip.transform }
        c.volume = clip.volume
        cursor += seg.end - seg.start
        return c
      })
      state.removeClip(clip.id)
      newClips.forEach(c => state.addClip(trackId, c))
      setStatus(`Removed ${localSilences.length} silent section${localSilences.length > 1 ? 's' : ''} (${(clip.duration - (cursor - clip.start)).toFixed(1)}s cut).`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Smart trim failed')
    } finally {
      setBusy(null)
    }
  }

  // ---- auto captions ----
  const autoCaptions = async () => {
    if (!limits.ai) { gate('AI Auto-Captions'); return }
    if (!selectedVideo) { setStatus('Select a video clip first'); return }
    const muxAssetId = selectedAsset?.muxAssetId
    if (!muxAssetId) {
      setStatus('Captions run on library videos (uploaded to HapiEats). Publish or pick a library clip, then caption it.')
      return
    }
    setBusy('captions')
    setStatus('Requesting AI captions…')
    try {
      const req = await requestCaptions(muxAssetId)
      if (!req.ok) { setStatus(req.error || 'Caption request failed'); return }
      // poll up to ~2 min
      let cues = null
      for (let i = 0; i < 40; i++) {
        setStatus(`Transcribing… (${i * 3}s)`)
        cues = await fetchCaptionCues(muxAssetId)
        if (cues) break
        await new Promise(r => setTimeout(r, 3000))
      }
      if (!cues || cues.length === 0) { setStatus('Captions are still processing — try again in a minute.'); return }
      // add caption clips to a new text track
      const state = useEditor.getState()
      const track = state.addTrack('text')
      state.updateTrack(track.id, { label: 'Captions' })
      const clip = selectedVideo.clip
      let added = 0
      for (const cue of cues) {
        const localStart = (cue.start - clip.in) / clip.speed
        const localEnd = (cue.end - clip.in) / clip.speed
        if (localEnd < 0 || localStart > clip.duration) continue
        const c = defaultClip('text', {
          label: cue.text.slice(0, 24),
          text: cue.text,
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 52, background: 'rgba(0,0,0,0.65)', animation: 'none' },
          start: clip.start + Math.max(0, localStart),
          duration: Math.max(0.5, Math.min(localEnd, clip.duration) - Math.max(0, localStart)),
        })
        c.transform.y = 38
        state.addClip(track.id, c)
        added++
      }
      setStatus(`Added ${added} caption${added === 1 ? '' : 's'} to a new track.`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Caption generation failed')
    } finally {
      setBusy(null)
    }
  }

  // ---- background removal ----
  const toggleBgRemoval = async () => {
    if (!limits.ai) { gate('AI Background Removal'); return }
    if (!selectedVideo) { setStatus('Select a video clip first'); return }
    const clip = selectedVideo.clip
    if (clip.removeBackground) {
      updateClip(clip.id, { removeBackground: false })
      setStatus('Background removal off.')
      return
    }
    setBusy('bg')
    setStatus('Loading segmentation model…')
    try {
      const ok = await engineRef.current?.loadSegmenter()
      if (!ok) { setStatus('Could not load the AI model — check your connection.'); return }
      updateClip(clip.id, { removeBackground: true })
      setStatus('Background removal on — subject is isolated in preview and export.')
    } finally {
      setBusy(null)
    }
  }

  const Tool = ({ icon: Icon, title, desc, onClick, active, id }: {
    icon: typeof Wand2; title: string; desc: string; onClick: () => void; active?: boolean; id: string
  }) => (
    <button
      onClick={onClick}
      disabled={busy !== null}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${active ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/60 hover:border-emerald-500/50'} disabled:opacity-60`}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/25 to-teal-500/10 border border-emerald-500/30">
        {busy === id ? <Loader2 className="h-4 w-4 animate-spin text-emerald-300" /> : <Icon className="h-4 w-4 text-emerald-300" />}
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-bold text-white">
          {title}
          {!limits.ai && <Crown className="h-3 w-3 text-amber-400" />}
        </p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">{desc}</p>
      </div>
    </button>
  )

  return (
    <div className="space-y-2">
      <Tool id="captions" icon={Captions} title="Auto-Captions" desc="AI transcription with timed caption clips, ready to restyle. Runs on your uploaded library videos." onClick={autoCaptions} />
      <Tool id="trim" icon={ScissorsLineDashed} title="Smart Trim" desc="Detects silent dead air in the selected clip and cuts it out automatically, packing the good parts together." onClick={smartTrim} />
      <Tool id="bg" icon={UserRound} title="Background Removal" desc="On-device ML segmentation isolates the person in the selected clip — great for picture-in-picture overlays." onClick={toggleBgRemoval} active={selectedVideo?.clip.removeBackground} />
      {status && <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-[11px] leading-relaxed text-zinc-300">{status}</p>}
      {!selectedVideo && <p className="text-[10px] text-zinc-600">Select a video clip on the timeline to enable AI tools.</p>}
    </div>
  )
}
