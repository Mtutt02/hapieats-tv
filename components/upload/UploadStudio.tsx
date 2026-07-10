'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import {
  UploadCloud, AlertCircle, Globe, Lock,
  ArrowRight, CheckCircle2, Scissors, X, Wand2, Plus, Film, ChevronDown, Clapperboard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import QuickEdit from '@/components/upload/QuickEdit'
import type { EditorOutput } from '@/components/editor/types'
import { useUploadStore, type UploadStatus } from '@/lib/upload-store'
import { composeFinalVideo } from '@/lib/video-compositor'
import { CLIP_CATEGORIES, CLIP_MAX_SECONDS, type ClipCategory } from '@/lib/clips/types'

interface Channel { id: string; name: string; slug: string }
interface Station { id: string; name: string; icon?: string | null }

interface UploadStudioProps {
  channels: Channel[]
  communityChannels?: Channel[]
  stations?: Station[]
  preselectedStation?: Station | null
  isCreator?: boolean
}

type Destination = { kind: 'general' | 'channel' | 'station'; id: string | null }

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

const MAX_UPLOAD_BYTES = 20 * 1024 ** 3

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Probe a video file's duration (seconds) with a temp <video> element. */
function probeDuration(file: File): Promise<number | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    const done = (d: number | null) => {
      URL.revokeObjectURL(url)
      resolve(d)
    }
    probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? probe.duration : null)
    probe.onerror = () => done(null)
    probe.src = url
  })
}

export default function UploadStudio({ channels, communityChannels = [], stations = [], preselectedStation }: UploadStudioProps) {
  const router = useRouter()
  const uploadStore = useUploadStore()

  const [destination, setDestination] = useState<Destination>(
    preselectedStation ? { kind: 'station', id: preselectedStation.id } : { kind: 'general', id: null }
  )

  const [files, setFiles] = useState<File[]>([])
  const [step, setStep] = useState<'select' | 'meta' | 'uploading' | 'done'>('select')
  const [editorOutput, setEditorOutput] = useState<EditorOutput | null>(null)
  const [dropError, setDropError] = useState<string | null>(null)
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null)
  const [composingProgress, setComposingProgress] = useState(0)
  const [isComposing, setIsComposing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  const [uploadIndex, setUploadIndex] = useState(0)
  const [totalUploads, setTotalUploads] = useState(0)
  const [composeWarning, setComposeWarning] = useState<string | null>(null)

  const [isClip, setIsClip] = useState(false)
  const [clipCategory, setClipCategory] = useState<ClipCategory>('food')
  const [clipLengthError, setClipLengthError] = useState<string | null>(null)
  const probedFileRef = useRef<File | null>(null)

  // Auto-enable "Post as Clip" when the first selected file is portrait and short.
  // Only ever turns the toggle ON — the user stays free to toggle it off.
  useEffect(() => {
    const first = files[0]
    if (!first || probedFileRef.current === first) return
    probedFileRef.current = first
    const url = URL.createObjectURL(first)
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      if (probe.videoHeight > probe.videoWidth && probe.duration <= CLIP_MAX_SECONDS + 5) {
        setIsClip(true)
      }
      URL.revokeObjectURL(url)
    }
    probe.onerror = () => URL.revokeObjectURL(url)
    probe.src = url
  }, [files])

  const onDrop = useCallback((accepted: File[]) => {
    setDropError(null)
    setClipLengthError(null)
    if (accepted.length === 0) return
    const valid: File[] = []
    const rejected: string[] = []
    for (const f of accepted) {
      if (f.size > MAX_UPLOAD_BYTES) rejected.push(`${f.name} (${formatBytes(f.size)})`)
      else valid.push(f)
    }
    if (rejected.length) setDropError(`Over the 20 GB limit: ${rejected.join(', ')}`)
    if (valid.length === 0) return
    setFiles(prev => [...prev, ...valid])
    setShowEditor(false)
    setStep('meta')
  }, [])

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    onDrop, accept: { 'video/*': [] }, multiple: true, noClick: step !== 'select', noDrag: false,
  })

  const removeFile = (index: number) => {
    setClipLengthError(null)
    setFiles(prev => {
      const next = prev.filter((_, i) => i !== index)
      if (index === 0) setEditorOutput(null) // edits belong to the first clip
      if (next.length === 0) setStep('select')
      return next
    })
  }

  /** Resolves once the current background upload finishes pushing bytes (or fails). */
  const waitForUploadSettled = () =>
    new Promise<UploadStatus>((resolve) => {
      const check = () => {
        const s = useUploadStore.getState().status
        if (s === 'processing' || s === 'done' || s === 'error') resolve(s)
        else setTimeout(check, 500)
      }
      setTimeout(check, 500)
    })

  const handleUpload = async () => {
    if (files.length === 0) return
    if (!title.trim()) { setTitleError('Add a title first'); return }
    setComposeWarning(null)

    // Clips must be short — validate every queued file before uploading anything.
    // Video mode is never blocked by length.
    setClipLengthError(null)
    if (isClip) {
      for (const f of files) {
        const duration = await probeDuration(f)
        if (duration != null && duration > CLIP_MAX_SECONDS + 5) {
          setClipLengthError(
            `Clips must be ${CLIP_MAX_SECONDS}s or less — '${f.name}' is ${formatDuration(duration)}. Post it as a Video instead.`
          )
          return
        }
      }
    }

    const output = editorOutput
    const trimmed = !!output && (
      output.clipStart > 0.05 ||
      (output.sourceDuration != null && output.clipEnd < output.sourceDuration - 0.05)
    )
    const hasEdits = !!output && (
      (output.overlays?.length ?? 0) > 0 ||
      !!output.filters?.preset ||
      output.filters?.brightness !== 0 ||
      output.filters?.contrast !== 0 ||
      output.filters?.saturation !== 0 ||
      output.filters?.warmth !== 0 ||
      output.filters?.blur !== 0 ||
      !!output.musicTrack ||
      !!output.voiceoverBlob ||
      trimmed
    )

    // Bake edits into the first clip (the one Quick Edit worked on)
    let firstFile = files[0]
    let editsBaked = false
    if (hasEdits && output) {
      setIsComposing(true)
      setComposingProgress(0)
      try {
        const composedBlob = await composeFinalVideo(files[0], output, { onProgress: setComposingProgress })
        firstFile = new File(
          [composedBlob],
          files[0].name.replace(/\.[^.]+$/, '') + '_edited.' + (composedBlob.type.includes('webm') ? 'webm' : 'mp4'),
          { type: composedBlob.type },
        )
        editsBaked = true
      } catch (err) {
        console.warn('Video composition failed, uploading original with edit metadata:', err)
        setComposeWarning('Rendering edits on this device failed — the original file was uploaded and your edit settings were saved with the video.')
      }
      setIsComposing(false)
    }

    const overlaysJson = (output?.overlays?.length ?? 0) > 0 ? JSON.stringify(output!.overlays) : null
    const filtersJson = output?.filters ? JSON.stringify(output.filters) : null
    const queue = [firstFile, ...files.slice(1)]
    setTotalUploads(queue.length)
    setStep('uploading')

    for (let i = 0; i < queue.length; i++) {
      setUploadIndex(i + 1)
      const isEditedClip = i === 0 && hasEdits
      await uploadStore.startUpload(queue[i], {
        title: i === 0 ? title.trim() : `${title.trim()} (${i + 1})`,
        description: description.trim() || undefined,
        channelId: destination.kind === 'channel' ? destination.id : null,
        visibility,
        pricingModel: 'free', postType: 'general', tags: null,
        stationId: destination.kind === 'station' ? destination.id : null,
        // persist edit settings with the edited clip so nothing is ever lost,
        // even when edits are already baked into the uploaded file
        clipStart: isEditedClip && !editsBaked ? output?.clipStart ?? null : null,
        clipEnd: isEditedClip && !editsBaked ? output?.clipEnd ?? null : null,
        overlays: isEditedClip && !editsBaked ? overlaysJson : null,
        musicTrack: isEditedClip && !editsBaked ? output?.musicTrack ?? null : null,
        filters: isEditedClip && !editsBaked ? filtersJson : null,
        voiceoverBlob: isEditedClip && !editsBaked ? output?.voiceoverBlob ?? null : null,
        isClip,
        clipCategory: isClip ? clipCategory : null,
      })
      if (useUploadStore.getState().status === 'error') break
      if (i === 0) setUploadedVideoId(useUploadStore.getState().videoId)
      const settled = await waitForUploadSettled()
      if (settled === 'error') break
    }

    // All files pushed — show the success screen (Mux keeps processing in background)
    if (useUploadStore.getState().status !== 'error') setStep('done')
  }

  // ─── Upload/Processing/Done screens ──────────────────────────────────
  if (step === 'uploading' || step === 'done' || isComposing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        {isComposing ? (
          <>
            <div className="relative mb-6">
              <div className="h-20 w-20 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Wand2 className="h-8 w-8 text-purple-400 animate-pulse" />
              </div>
              {composingProgress > 0 && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-full px-3 py-1 text-xs font-mono text-purple-400">
                  {composingProgress}%
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold mb-2">Applying edits...</h2>
            <p className="text-zinc-400 text-sm">Rendering overlays, filters, music, and trim into final video.</p>
            <div className="w-64 h-1.5 rounded-full bg-zinc-800 mt-6 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-primary transition-all duration-300"
                style={{ width: `${composingProgress}%` }}
              />
            </div>
          </>
        ) : step === 'uploading' ? (
          <>
            <div className="relative mb-6">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <UploadCloud className="h-8 w-8 text-primary animate-bounce" />
              </div>
              {uploadStore.progress > 0 && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-full px-3 py-1 text-xs font-mono text-primary">{uploadStore.progress}%</div>}
            </div>
            <h2 className="text-xl font-bold mb-2">
              {totalUploads > 1 ? `Uploading video ${uploadIndex} of ${totalUploads}…` : 'Uploading...'}
            </h2>
            <p className="text-zinc-400 text-sm">
              {totalUploads > 1 ? 'Each clip publishes as its own video.' : 'Your video is uploading.'}
            </p>
            {composeWarning && (
              <p className="mt-3 max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">{composeWarning}</p>
            )}
            {uploadStore.status === 'error' && uploadStore.error && (
              <p className="mt-3 max-w-sm rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">{uploadStore.error}</p>
            )}
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => router.push('/')}>Browse</Button>
              <Button onClick={() => router.push('/studio/videos')}>My videos</Button>
            </div>
          </>
        ) : (
          <>
            <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Published!</h2>
            <p className="text-zinc-400 text-sm mb-6">{title} is live.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setFiles([]); setStep('select'); setTitle(''); setDescription(''); setEditorOutput(null); setTotalUploads(0); setUploadIndex(0); setComposeWarning(null) }}>Upload another</Button>
              {uploadedVideoId && <Button onClick={() => router.push(`/watch/${uploadedVideoId}`)}>View video <ArrowRight className="h-4 w-4 ml-1" /></Button>}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* ─── Select step ───────────────────────────────────────────────── */}
      {step === 'select' && (
        <div {...getRootProps()} className={cn('border-2 border-dashed rounded-2xl cursor-pointer transition-all text-center py-24 px-6', isDragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-zinc-700 hover:border-primary/50 hover:bg-zinc-900/30')}>
          <input {...getInputProps()} />
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"><UploadCloud className="h-8 w-8 text-primary" /></div>
          <p className="text-lg font-bold mb-1">{isDragActive ? 'Drop your videos' : 'Drop videos to start'}</p>
          <p className="text-zinc-500 text-sm mb-6">or click to browse — select multiple clips to batch upload</p>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            {['MP4', 'MOV', 'WebM'].map(fmt => (<span key={fmt} className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 font-mono">{fmt}</span>))}
            <span className="text-zinc-700 mx-1">·</span><span className="text-zinc-600">Up to 20 GB</span>
          </div>
          {dropError && <div className="mt-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs max-w-sm mx-auto"><AlertCircle className="h-4 w-4 shrink-0" />{dropError}</div>}
        </div>
      )}

      {/* ─── Meta + Details + Collapsible Editor ─────────────────────── */}
      {step === 'meta' && (
        <div className="space-y-6">
          {/* File summary — supports multiple clips */}
          <div className="space-y-1.5">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-3 p-3 rounded-xl border bg-zinc-900/50">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Film className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-white">{f.name}</p>
                  <p className="text-xs text-zinc-500">
                    {formatBytes(f.size)}
                    {files.length > 1 && i === 0 && editorOutput ? ' · quick edits apply to this clip' : ''}
                    {files.length > 1 && i > 0 ? ` · publishes as “${title.trim() || 'title'} (${i + 1})”` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-red-400 shrink-0"
                  onClick={() => removeFile(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <button
              type="button"
              onClick={openFilePicker}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 py-2 text-xs text-zinc-400 hover:border-primary/50 hover:text-zinc-200"
            >
              <Plus className="h-3.5 w-3.5" /> Add more clips
            </button>
          </div>

          {/* ── Post as: Video / Clip — big segmented selector ── */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { setIsClip(false); setClipLengthError(null) }}
              aria-pressed={!isClip}
              className={cn(
                'flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all',
                !isClip
                  ? 'border-primary bg-primary/10 shadow-[0_0_20px_-8px] shadow-primary/40'
                  : 'border-zinc-800 hover:border-zinc-600 opacity-70 hover:opacity-100'
              )}
            >
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', !isClip ? 'bg-primary/20' : 'bg-zinc-800')}>
                <Film className={cn('h-5 w-5', !isClip ? 'text-primary' : 'text-zinc-400')} />
              </div>
              <div className="min-w-0">
                <p className={cn('text-sm font-bold', !isClip ? 'text-white' : 'text-zinc-300')}>Video</p>
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">Long-form, shows on your channel &amp; home feed</p>
              </div>
              {!isClip && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-primary" />}
            </button>

            <button
              type="button"
              onClick={() => { setIsClip(true); setClipLengthError(null) }}
              aria-pressed={isClip}
              className={cn(
                'flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all',
                isClip
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_-8px] shadow-emerald-500/40'
                  : 'border-zinc-800 hover:border-zinc-600 opacity-70 hover:opacity-100'
              )}
            >
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', isClip ? 'bg-emerald-500/20' : 'bg-zinc-800')}>
                <Clapperboard className={cn('h-5 w-5', isClip ? 'text-emerald-400' : 'text-zinc-400')} />
              </div>
              <div className="min-w-0">
                <p className={cn('text-sm font-bold', isClip ? 'text-white' : 'text-zinc-300')}>Clip</p>
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">Vertical short (≤{CLIP_MAX_SECONDS}s), lands in the Clips feed</p>
              </div>
              {isClip && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-400" />}
            </button>
          </div>

          {clipLengthError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300 -mt-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {clipLengthError}
            </div>
          )}

          {isClip && (
            <div className="flex flex-wrap items-center gap-1.5 -mt-2">
              <span className="mr-1 text-[11px] text-zinc-500">Category:</span>
              {CLIP_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setClipCategory(cat)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11px] capitalize transition-all',
                    clipCategory === cat
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                      : 'border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                  )}
                >
                  {cat}
                </button>
              ))}
              {files.length > 1 && (
                <span className="w-full text-[11px] text-zinc-600">All {files.length} files in this batch post as Clips.</span>
              )}
            </div>
          )}

          {/* ── Post to: destination selector ── */}
          <div className="space-y-1.5">
            <label htmlFor="post-destination" className="text-xs font-medium text-zinc-400">Post to</label>
            <div className="relative">
              <select
                id="post-destination"
                value={destination.kind === 'general' ? 'general' : `${destination.kind}:${destination.id}`}
                onChange={e => {
                  const v = e.target.value
                  if (v === 'general') {
                    setDestination({ kind: 'general', id: null })
                  } else {
                    const [kind, id] = v.split(':')
                    setDestination({ kind: kind as 'channel' | 'station', id })
                  }
                }}
                className="w-full appearance-none bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-primary/50"
              >
                <option value="general">My profile (general)</option>
                {channels.length > 0 && (
                  <optgroup label="My channels">
                    {channels.map(c => (
                      <option key={c.id} value={`channel:${c.id}`}>{c.name}</option>
                    ))}
                  </optgroup>
                )}
                {communityChannels.length > 0 && (
                  <optgroup label="Community channels">
                    {communityChannels.map(c => (
                      <option key={c.id} value={`channel:${c.id}`}>{c.name}</option>
                    ))}
                  </optgroup>
                )}
                {stations.length > 0 && (
                  <optgroup label="Stations">
                    {stations.map(s => (
                      <option key={s.id} value={`station:${s.id}`}>{s.icon ? `${s.icon} ${s.name}` : s.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </div>
            <p className="text-[11px] text-zinc-600">
              Stations are public category feeds anyone can post to. Community channels accept posts from all creators.
            </p>
          </div>

          {/* Title + Visibility + Publish row */}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <input
                value={title}
                onChange={e => { setTitle(e.target.value); setTitleError(null) }}
                placeholder="Add a title..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-base placeholder-zinc-600 focus:outline-none focus:border-primary/50"
              />
              {titleError && <p className="text-red-400 text-xs mt-1">{titleError}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {[{ value: 'public' as const, icon: Globe }, { value: 'private' as const, icon: Lock }].map(opt => (
                <button key={opt.value} onClick={() => setVisibility(opt.value)}
                  className={cn('p-2.5 rounded-lg border transition-all', visibility === opt.value ? 'border-primary bg-primary/10 text-primary' : 'border-zinc-800 text-zinc-600 hover:text-zinc-400')}>
                  <opt.icon className="h-4 w-4" />
                </button>
              ))}
              <Button onClick={handleUpload} disabled={!title.trim() || uploadStore.status === 'uploading' || isComposing} className="gap-2 h-10">
                <UploadCloud className="h-4 w-4" /> Publish
              </Button>
            </div>
          </div>

          {/* Description */}
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Tell viewers what this video is about…"
            rows={3}
            className="bg-zinc-900 border-zinc-700 text-white placeholder-zinc-600"
          />

          {/* Collapsible Edit video section */}
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowEditor(!showEditor)}
              className={cn(
                'flex items-center justify-between w-full px-4 py-3 text-sm font-medium transition-colors',
                showEditor ? 'bg-primary/5 border-b border-zinc-800' : 'hover:bg-zinc-900/60'
              )}
            >
              <div className="flex items-center gap-2">
                <Scissors className={cn('h-4 w-4 transition-colors', showEditor && 'text-primary')} />
                <span className={showEditor ? 'text-primary' : 'text-zinc-300'}>Quick edit</span>
                {editorOutput && !showEditor && (
                  <span className="text-xs text-zinc-500 ml-1">
                    (trim{editorOutput.overlays?.length ? ', overlays' : ''}{editorOutput.musicTrack ? ', music' : ''}{editorOutput.filters?.preset ? ', filters' : ''})
                  </span>
                )}
              </div>
              <ChevronDown className={cn('h-4 w-4 text-zinc-500 transition-transform', showEditor && 'rotate-180')} />
            </button>
            {showEditor && (
              <div className="bg-zinc-950">
                <QuickEdit
                  files={files}
                  onComplete={(output) => { setEditorOutput(output); setShowEditor(false) }}
                  onCancel={() => setShowEditor(false)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
