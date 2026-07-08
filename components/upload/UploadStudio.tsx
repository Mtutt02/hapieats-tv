'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import {
  UploadCloud, AlertCircle, Globe, Lock,
  ArrowRight, CheckCircle2, Scissors, X, Wand2, Plus, Film, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import EditorPanel from '@/components/editor/EditorPanel'
import type { EditorOutput } from '@/components/editor/types'
import { useUploadStore } from '@/lib/upload-store'
import { composeFinalVideo } from '@/lib/video-compositor'

interface Channel { id: string; name: string; slug: string }
interface Station { id: string; name: string }

interface UploadStudioProps {
  channels: Channel[]
  preselectedStation?: Station | null
  isCreator?: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

const MAX_UPLOAD_BYTES = 20 * 1024 ** 3

export default function UploadStudio({ channels }: UploadStudioProps) {
  const router = useRouter()
  const uploadStore = useUploadStore()

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

  const onDrop = useCallback((accepted: File[]) => {
    setDropError(null)
    if (accepted.length === 0) return
    const f = accepted[0]
    if (f.size > MAX_UPLOAD_BYTES) {
      setDropError(`File is ${formatBytes(f.size)} — 20 GB max.`)
      return
    }
    setFiles(accepted)
    setEditorOutput(null)
    setShowEditor(false)
    setStep('meta')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'video/*': [] }, maxFiles: 1, disabled: step !== 'select',
  })

  const handleUpload = async () => {
    if (files.length === 0) return
    if (!title.trim()) { setTitleError('Add a title first'); return }

    const hasEdits = editorOutput && (
      (editorOutput.overlays && editorOutput.overlays.length > 0) ||
      editorOutput.filters?.preset ||
      editorOutput.filters?.brightness !== 0 ||
      editorOutput.filters?.contrast !== 0 ||
      editorOutput.filters?.saturation !== 0 ||
      editorOutput.filters?.warmth !== 0 ||
      editorOutput.filters?.blur !== 0 ||
      editorOutput.musicTrack ||
      editorOutput.voiceoverBlob ||
      editorOutput.clipStart !== 0 ||
      editorOutput.clipEnd !== files[0]?.size
    )

    let uploadFile = files[0]

    if (hasEdits && editorOutput) {
      setIsComposing(true)
      setComposingProgress(0)
      try {
        const composedBlob = await composeFinalVideo(files[0], editorOutput, {
          onProgress: setComposingProgress,
        })
        uploadFile = new File([composedBlob], files[0].name.replace(/\.[^.]+$/, '') + '_edited.' +
          (composedBlob.type.includes('webm') ? 'webm' : 'mp4'),
          { type: composedBlob.type })
      } catch (err) {
        console.warn('Video composition failed, uploading original:', err)
      }
      setIsComposing(false)
    }

    const overlaysJson = (editorOutput?.overlays && editorOutput.overlays.length > 0) ? JSON.stringify(editorOutput.overlays) : null
    const filtersJson = editorOutput?.filters ? JSON.stringify(editorOutput.filters) : null
    await uploadStore.startUpload(uploadFile, {
      title: title.trim(),
      description: description.trim() || undefined,
      channelId: channels[0]?.id || null,
      visibility,
      pricingModel: 'free', postType: 'general', tags: null,
      stationId: null,
      clipStart: editorOutput?.clipStart ?? null,
      clipEnd: editorOutput?.clipEnd ?? null,
      overlays: overlaysJson,
      musicTrack: editorOutput?.musicTrack ?? null,
      filters: filtersJson,
      voiceoverBlob: editorOutput?.voiceoverBlob ?? null,
    })
    if (uploadStore.status !== 'error') { setStep('uploading'); setUploadedVideoId(uploadStore.videoId) }
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
            <h2 className="text-xl font-bold mb-2">Uploading...</h2>
            <p className="text-zinc-400 text-sm">Your video is uploading.</p>
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
              <Button variant="outline" onClick={() => { setFiles([]); setStep('select'); setTitle(''); setDescription(''); setEditorOutput(null) }}>Upload another</Button>
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
          <p className="text-lg font-bold mb-1">{isDragActive ? 'Drop your video' : 'Drop a video to start'}</p>
          <p className="text-zinc-500 text-sm mb-6">or click to browse files</p>
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
          {/* File summary bar */}
          <div className="flex items-center gap-3 p-3 rounded-xl border bg-zinc-900/50">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Film className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-white">{files[0]?.name}</p>
              <p className="text-xs text-zinc-500">{files[0] ? formatBytes(files[0].size) : ''}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-500 hover:text-red-400 shrink-0"
              onClick={() => { setFiles([]); setEditorOutput(null); setStep('select') }}
            >
              <X className="h-4 w-4" />
            </Button>
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
                <span className={showEditor ? 'text-primary' : 'text-zinc-300'}>Edit video</span>
                {editorOutput && !showEditor && (
                  <span className="text-xs text-zinc-500 ml-1">
                    (trim{editorOutput.overlays?.length ? ', overlays' : ''}{editorOutput.musicTrack ? ', music' : ''}{editorOutput.filters?.preset ? ', filters' : ''})
                  </span>
                )}
              </div>
              <ChevronDown className={cn('h-4 w-4 text-zinc-500 transition-transform', showEditor && 'rotate-180')} />
            </button>
            {showEditor && (
              <div className="bg-zinc-950" style={{ height: '70vh' }}>
                <EditorPanel
                  files={files}
                  onComplete={(output) => { setEditorOutput(output); setShowEditor(false) }}
                  onCancel={() => setShowEditor(false)}
                  showTutorial={false}
                  onDismissTutorial={() => {}}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
