'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
<<<<<<< HEAD
  UploadCloud, Film, AlertCircle, X, Globe, Tv, Scissors,
  GraduationCap, Wand2, Tag, Eye, DollarSign, ArrowRight, CheckCircle2,
=======
  UploadCloud, Film, AlertCircle, X, Globe, Tv,
  Scissors, Wand2, Tag, Eye, DollarSign, ArrowRight, CheckCircle2,
  ChevronLeft, ChevronRight, Clock, Sparkles, Share2, Lock,
  Hash, Image, Music, Crop,
>>>>>>> 6020e75 (redesign: unified Creator Studio upload flow)
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import VideoEditor from './VideoEditor'
import { useUploadStore } from '@/lib/upload-store'

<<<<<<< HEAD
// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  postType: z.enum(['general', 'channel']),
  channelId: z.string().optional(),
  tags: z.string().optional(),
  visibility: z.enum(['public', 'private', 'unlisted']),
  pricingModel: z.enum(['free', 'pay_per_view', 'subscription']),
  price: z.coerce.number().min(0).optional(),
})
type FormValues = z.infer<typeof schema>

=======
// ─── Types ───────────────────────────────────────────────────────────────────
>>>>>>> 6020e75 (redesign: unified Creator Studio upload flow)
interface Channel { id: string; name: string; slug: string }
interface Station { id: string; name: string }

interface UploadStudioProps {
  channels: Channel[]
  preselectedStation?: Station | null
  isCreator?: boolean
}

<<<<<<< HEAD
type Step = 'drop' | 'edit' | 'meta' | 'started'

interface ClipInfo { startTime: number; endTime: number; duration: number }
=======
interface ClipInfo { startTime: number; endTime: number; duration: number }

type Step = 'file' | 'trim' | 'details' | 'uploading' | 'done'
>>>>>>> 6020e75 (redesign: unified Creator Studio upload flow)

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

<<<<<<< HEAD
/** Rough upload time at 20 Mbps (2.5 MB/s) average US residential */
function uploadEstimate(bytes: number): string {
  const seconds = bytes / (2.5 * 1024 * 1024)
  if (seconds < 60)  return 'under a minute'
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min`
  return `~${(seconds / 3600).toFixed(1)} hr`
}

const MAX_UPLOAD_BYTES = 20 * 1024 ** 3 // 20 GB

// ─── Section header ───────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      {children}
    </div>
  )
}

// ─── EditorPanel (HapiEats TV Studio iframe) ──────────────────────────────────
const editorMetaSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  visibility: z.enum(['public', 'private', 'unlisted']),
  pricingModel: z.enum(['free', 'pay_per_view', 'subscription']),
  price: z.coerce.number().min(0).optional(),
})
type EditorMetaValues = z.infer<typeof editorMetaSchema>

function EditorPanel({ isCreator, preselectedStation, onVideoSaved }: {
  isCreator: boolean
  preselectedStation?: Station | null
  onVideoSaved: (videoId: string) => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [editorStep, setEditorStep] = useState<'idle' | 'uploading' | 'meta' | 'saving' | 'error'>('idle')
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [editorErr, setEditorErr] = useState<string | null>(null)

  const metaForm = useForm<EditorMetaValues>({
    resolver: zodResolver(editorMetaSchema),
    defaultValues: { visibility: 'public', pricingModel: 'free' },
  })
  const editorPricingModel = metaForm.watch('pricingModel')

  const onMessage = useCallback(async (event: MessageEvent) => {
    const { type, ...payload } = event.data ?? {}
    if (type === 'HAPIEATS_EDITOR_READY') setEditorStep('idle')
    if (type === 'HAPIEATS_EXPORT_STARTED' || type === 'HAPIEATS_VIDEO_EXPORTED') setEditorStep('uploading')
    if (type === 'HAPIEATS_REQUEST_UPLOAD_URL') {
      try {
        const res = await fetch('/api/mux/direct-upload')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Failed to get upload URL')
        setUploadId(json.uploadId)
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'HAPIEATS_MUX_UPLOAD_URL', url: json.uploadUrl },
          window.location.origin,
        )
      } catch (e) {
        setEditorErr(e instanceof Error ? e.message : 'Could not get upload URL')
        setEditorStep('error')
      }
    }
    if (type === 'HAPIEATS_MUX_UPLOADED') setEditorStep('meta')
    void payload
  }, [])

  // Listen for iframe messages
  const iframeContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) window.addEventListener('message', onMessage)
    else window.removeEventListener('message', onMessage)
  }, [onMessage])

  const onEditorMetaSubmit = async (values: EditorMetaValues) => {
    if (!uploadId) return
    setEditorStep('saving')
    setEditorErr(null)
    try {
      const res = await fetch('/api/mux/editor-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          title: values.title,
          description: values.description,
          visibility: values.visibility,
          pricingModel: values.pricingModel,
          price: values.pricingModel === 'pay_per_view' ? values.price : null,
          stationId: preselectedStation?.id ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save video')
      onVideoSaved(json.videoId)
    } catch (e) {
      setEditorErr(e instanceof Error ? e.message : 'Save failed')
      setEditorStep('error')
    }
  }

  return (
    <div className="relative" ref={iframeContainerRef}>
      {editorStep === 'uploading' && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-medium text-center animate-pulse">
          HapiEats TV Studio — uploading your edited video…
        </div>
      )}
      {editorStep === 'error' && editorErr && (
        <div className="mb-3 flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />{editorErr}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 px-1">
        <Wand2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">HapiEats TV Studio</span>
        <span className="text-xs text-zinc-500">— AI-powered video editing</span>
      </div>

      <div className="rounded-2xl overflow-hidden border border-zinc-800" style={{ height: '65vh', minHeight: 520 }}>
        <iframe
          ref={iframeRef}
          src="/munchor-studio/munchor_studio_editor.html"
          allow="microphone; camera; autoplay; fullscreen; clipboard-read; clipboard-write"
          className="w-full h-full bg-zinc-950"
          title="HapiEats TV Studio Video Editor"
        />
      </div>
      <p className="text-xs text-zinc-500 text-center mt-2">
        Edit in HapiEats TV Studio, then click <strong>Export</strong> to publish.
      </p>

      {editorStep === 'meta' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Publish Your Video
              </h2>
              <p className="text-sm text-zinc-400 mt-0.5">Add details to publish to HapiEats TV.</p>
            </div>
            <form onSubmit={metaForm.handleSubmit(onEditorMetaSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="e-title">Title *</Label>
                <Input id="e-title" placeholder="My food video" {...metaForm.register('title')} className="mt-1.5" />
                {metaForm.formState.errors.title && (
                  <p className="text-destructive text-xs mt-1">{metaForm.formState.errors.title.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="e-desc">Description</Label>
                <Textarea id="e-desc" rows={2} placeholder="What's this video about?" {...metaForm.register('description')} className="mt-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Visibility</Label>
                  <Select onValueChange={(v) => metaForm.setValue('visibility', v as 'public' | 'private' | 'unlisted')} defaultValue="public">
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="unlisted">Unlisted</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Monetization</Label>
                  {isCreator ? (
                    <Select onValueChange={(v) => metaForm.setValue('pricingModel', v as 'free' | 'pay_per_view' | 'subscription')} defaultValue="free">
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="pay_per_view">Pay Per View</SelectItem>
                        <SelectItem value="subscription">Subscribers Only</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1.5 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800/40 text-xs text-zinc-400">
                      Free only — <a href="/creator/chef-verification" className="text-primary hover:underline">apply for Creator</a>
                    </div>
                  )}
                </div>
              </div>
              {isCreator && editorPricingModel === 'pay_per_view' && (
                <div>
                  <Label htmlFor="e-price">Price (USD)</Label>
                  <Input id="e-price" type="number" step="0.01" min="0.50" placeholder="4.99" {...metaForm.register('price')} className="mt-1.5" />
                </div>
              )}
              {preselectedStation && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                  <span className="text-primary font-medium">📡 Station:</span>
                  <span className="font-semibold">{preselectedStation.name}</span>
                </div>
              )}
              <Button type="submit" className="w-full gap-2" size="lg" disabled={editorStep === 'saving'}>
                {editorStep === 'saving' ? 'Publishing…' : 'Publish Video'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main UploadStudio ────────────────────────────────────────────────────────
=======
function uploadEstimate(bytes: number): string {
  const seconds = bytes / (2.5 * 1024 * 1024)
  if (seconds < 60) return 'under a minute'
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min`
  return `~${(seconds / 3600).toFixed(1)} hr`
}

const MAX_UPLOAD_BYTES = 20 * 1024 ** 3

// ─── Step Indicator ──────────────────────────────────────────────────────────
const STEPS = [
  { id: 'file' as Step, label: 'Select', icon: Film },
  { id: 'trim' as Step, label: 'Trim', icon: Scissors },
  { id: 'details' as Step, label: 'Details', icon: Sparkles },
  { id: 'uploading' as Step, label: 'Upload', icon: UploadCloud },
]

function StepBar({ current, goTo }: { current: Step; goTo: (s: Step) => void }) {
  const idx = STEPS.findIndex(s => s.id === current)
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const Icon = s.icon
        const isActive = i <= idx
        const isCurrent = s.id === current
        return (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => isActive && goTo(s.id)}
              disabled={!isActive}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all',
                isCurrent ? 'bg-primary/15 text-primary border border-primary/30' : '',
                isActive && !isCurrent ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/60' : '',
                !isActive ? 'text-zinc-700 cursor-not-allowed' : '',
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', isCurrent ? 'text-primary' : '')} />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-px mx-2',
                i < idx ? 'bg-primary/40' : 'bg-zinc-800',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main UploadStudio ───────────────────────────────────────────────────────
>>>>>>> 6020e75 (redesign: unified Creator Studio upload flow)
export default function UploadStudio({ channels, preselectedStation, isCreator = false }: UploadStudioProps) {
  const router = useRouter()
  const uploadStore = useUploadStore()

<<<<<<< HEAD
  const [mode,      setMode]      = useState<'upload' | 'editor'>('upload')
  const [step,      setStep]      = useState<Step>('drop')
  const [file,      setFile]      = useState<File | null>(null)
  const [clip,      setClip]      = useState<ClipInfo | null>(null)
  const [dropError, setDropError] = useState<string | null>(null)
  const [stationId]               = useState<string | null>(preselectedStation?.id ?? null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { visibility: 'public', pricingModel: 'free', postType: 'general' },
  })

  const pricingModel = form.watch('pricingModel')
  const postType     = form.watch('postType')
=======
  const [step, setStep] = useState<Step>('file')
  const [file, setFile] = useState<File | null>(null)
  const [clip, setClip] = useState<ClipInfo | null>(null)
  const [dropError, setDropError] = useState<string | null>(null)
  const [stationId] = useState<string | null>(preselectedStation?.id ?? null)
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private' | 'unlisted'>('public')
  const [pricingModel, setPricingModel] = useState<'free' | 'pay_per_view' | 'subscription'>('free')
  const [price, setPrice] = useState('')
  const [postType, setPostType] = useState<'general' | 'channel'>('general')
  const [channelId, setChannelId] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)
>>>>>>> 6020e75 (redesign: unified Creator Studio upload flow)

  const onDrop = useCallback((accepted: File[]) => {
    setDropError(null)
    const f = accepted[0]
    if (!f) return
    if (f.size > MAX_UPLOAD_BYTES) {
<<<<<<< HEAD
      setDropError(`File is ${formatBytes(f.size)} — max supported size is 20 GB. Please compress or trim before uploading.`)
      return
    }
    setFile(f); setClip(null); setStep('edit')
=======
      setDropError(`File is ${formatBytes(f.size)} — 20 GB max.`)
      return
    }
    setFile(f)
    setClip(null)
    setStep('trim')
>>>>>>> 6020e75 (redesign: unified Creator Studio upload flow)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': [] },
    maxFiles: 1,
    disabled: step !== 'file',
  })

<<<<<<< HEAD
  const onSubmit = async (values: FormValues) => {
    if (!file) return
    const tagsArray = values.tags
      ? values.tags.split(',').map(t => t.trim()).filter(Boolean)
      : []

    // Start upload in global store — survives navigation
    await uploadStore.startUpload(file, {
      title: values.title,
      description: values.description,
      channelId: values.postType === 'channel' ? (values.channelId ?? null) : null,
      visibility: values.visibility,
      pricingModel: values.pricingModel,
      price: values.pricingModel === 'pay_per_view' ? (values.price ?? null) : null,
      postType: values.postType,
      tags: tagsArray.length > 0 ? tagsArray.join(',') : null,
      stationId: stationId ?? null,
      clipStart: clip?.startTime ?? null,
      clipEnd: clip?.endTime ?? null,
    })

    if (uploadStore.status !== 'error') {
      setStep('started')
    }
  }

  // ── Tab bar ────────────────────────────────────────────────────────────────
  const tabBar = (
    <div className="flex rounded-xl border border-zinc-800 overflow-hidden mb-6">
      {([
        ['upload',  UploadCloud,   'Upload File'],
        ['editor',  Wand2,         'TV Studio'],
        ['classes', GraduationCap, 'Classes'],
      ] as const).map(([m, Icon, label]) => (
        <button
          key={m}
          type="button"
          onClick={() => {
            if (m === 'classes') { router.push('/studio/classes/new'); return }
            setMode(m as 'upload' | 'editor')
          }}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
            (mode === m) ? 'bg-primary text-primary-foreground' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60',
          )}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{label.split(' ')[0]}</span>
        </button>
      ))}
    </div>
  )

  // ── Upload started — navigate away freely ─────────────────────────────────
  if (step === 'started') {
    return (
      <div className="text-center py-20 space-y-5 max-w-md mx-auto">
        <div className="h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
          <UploadCloud className="h-8 w-8 text-primary animate-pulse" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Upload Underway!</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Your video is uploading in the background. You can browse the rest of HapiEats TV — a progress bar in the corner will keep you posted.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => router.push('/')}>Browse Videos</Button>
          <Button onClick={() => router.push('/studio/videos')} className="gap-2">
            My Videos <ArrowRight className="h-4 w-4" />
          </Button>
=======
  const handleUpload = async () => {
    if (!file) return
    if (!title.trim()) { setTitleError('Add a title first'); return }

    const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []

    await uploadStore.startUpload(file, {
      title: title.trim(),
      description: description.trim() || undefined,
      channelId: postType === 'channel' ? (channelId || null) : null,
      visibility,
      pricingModel,
      price: pricingModel === 'pay_per_view' ? (parseFloat(price) || null) : null,
      postType,
      tags: tagsArray.length > 0 ? tagsArray.join(',') : null,
      stationId: stationId ?? null,
      clipStart: clip?.startTime ?? null,
      clipEnd: clip?.endTime ?? null,
    })

    if (uploadStore.status !== 'error') {
      setStep('uploading')
      setUploadedVideoId(uploadStore.videoId)
    }
  }

  // ── Determine which file details to show ──────────────────────────────────
  const fileSizeLabel = file ? formatBytes(file.size) : ''
  const fileTimeLabel = file ? uploadEstimate(file.size) : ''
  const videoDuration = clip
    ? `Clipped: ${formatDuration(clip.startTime)} — ${formatDuration(clip.endTime)} (${Math.floor(clip.duration / 60)}:${String(Math.floor(clip.duration % 60)).padStart(2, '0')})`
    : 'Full video'

  // ── Done screen ───────────────────────────────────────────────────────────
  if (step === 'uploading' || step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        {step === 'uploading' ? (
          <>
            <div className="relative mb-8">
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                <UploadCloud className="h-10 w-10 text-primary animate-bounce" />
              </div>
              {uploadStore.progress > 0 && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-full px-3 py-1 text-xs font-mono text-primary">
                  {uploadStore.progress}%
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold mb-2">Upload in progress</h2>
            <p className="text-zinc-400 text-sm max-w-md mb-3">
              {title} is uploading. You can navigate away — we&apos;ll keep going in the background.
            </p>
            {fileSizeLabel && (
              <div className="flex items-center gap-3 text-xs text-zinc-500 mb-8">
                <span>{fileSizeLabel}</span>
                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                <span>~{fileTimeLabel}</span>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push('/')}>Browse videos</Button>
              <Button onClick={() => router.push('/studio/videos')} className="gap-2">
                My videos <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="h-24 w-24 rounded-full bg-emerald-500/10 flex items-center justify-center mb-8">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Published!</h2>
            <p className="text-zinc-400 text-sm mb-8">{title} is live.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setFile(null); setStep('file'); setTitle(''); setDescription(''); setTags(''); }}>
                Upload another
              </Button>
              {uploadedVideoId && (
                <Button onClick={() => router.push(`/watch/${uploadedVideoId}`)} className="gap-2">
                  View video <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Wand2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">HapiEats Creator Studio</h1>
          <p className="text-xs text-zinc-500">Upload, trim, and publish your food content</p>
>>>>>>> 6020e75 (redesign: unified Creator Studio upload flow)
        </div>
      </div>

<<<<<<< HEAD
  // ── Editor mode ────────────────────────────────────────────────────────────
  if (mode === 'editor') {
    return (
      <div>
        {tabBar}
        <EditorPanel
          isCreator={isCreator}
          preselectedStation={preselectedStation}
          onVideoSaved={(id) => {
            uploadStore.setDone()
            router.push(`/watch/${id}`)
          }}
        />
      </div>
    )
  }

  // ── Drop zone ──────────────────────────────────────────────────────────────
  if (step === 'drop') {
    return (
      <div>
        {tabBar}
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-2xl p-20 text-center cursor-pointer transition-all group',
            isDragActive
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-zinc-700 hover:border-primary/60 hover:bg-zinc-900/40',
          )}
        >
          <input {...getInputProps()} />
          <div className="h-20 w-20 mx-auto mb-5 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <UploadCloud className="h-10 w-10 text-primary" />
          </div>
          <p className="text-xl font-bold mb-2">
            {isDragActive ? 'Drop your video here' : 'Drag & drop your video'}
          </p>
          <p className="text-zinc-400 text-sm mb-4">or click to browse your files</p>
          <div className="flex items-center justify-center gap-3 text-xs text-zinc-600 mb-4">
            {['MP4', 'MOV', 'MKV', 'WebM', 'AVI'].map(fmt => (
              <span key={fmt} className="px-2 py-1 rounded-md bg-zinc-800 font-mono">{fmt}</span>
            ))}
          </div>
          <div className="flex items-center justify-center gap-4 text-xs text-zinc-600">
            <span>Up to 4 hours of footage</span>
            <span>·</span>
            <span>Max 20 GB</span>
            <span>·</span>
            <span>Trim after selecting</span>
          </div>
          {dropError && (
            <div className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/10 text-destructive text-xs max-w-sm mx-auto">
              <AlertCircle className="h-4 w-4 shrink-0" />{dropError}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Video Editor (trim/clip) ───────────────────────────────────────────────
  if (step === 'edit' && file) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Scissors className="h-5 w-5 text-primary" />
              Trim Your Clip
            </h2>
            <p className="text-sm text-zinc-400 mt-1">Drag the handles to select the section you want to publish.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setClip(null); setStep('meta') }}>
            Skip — use full video
          </Button>
        </div>
        <VideoEditor
          file={file}
          onClipSelected={(s, e, d) => { setClip({ startTime: s, endTime: e, duration: d }); setStep('meta') }}
          onCancel={() => { setFile(null); setStep('drop') }}
        />
      </div>
    )
  }

  // ── Metadata form (two-column on desktop) ──────────────────────────────────
  const uploadError = uploadStore.status === 'error' ? uploadStore.error : null

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">

        {/* ── LEFT: file card + status ─────────────────────────────────── */}
        <div className="space-y-4">
          {/* File summary */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Film className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm truncate">{file?.name}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {clip
                  ? `Clipped: ${formatDuration(clip.startTime)} → ${formatDuration(clip.endTime)}`
                  : 'Full video'}
              </p>
              {file && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                    {formatBytes(file.size)}
                  </span>
                  <span className="text-xs text-zinc-600">
                    ~{uploadEstimate(file.size)} to upload
                  </span>
                </div>
              )}
              {file && file.size > 8 * 1024 ** 3 && (
                <p className="text-[10px] text-amber-400/80 mt-1.5 leading-snug">
                  Large file — upload may take a while. You can browse the app while it uploads.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => setStep('edit')}>
                <Scissors className="h-3 w-3" /> Re-trim
              </Button>
              <Button
                type="button" variant="ghost" size="icon"
                className="h-8 w-8 text-zinc-500 hover:text-red-400"
                onClick={() => { setFile(null); setClip(null); setStep('drop') }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {preselectedStation && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-sm">
              <span className="text-primary font-medium">📡</span>
              <span className="text-xs font-semibold">{preselectedStation.name}</span>
            </div>
          )}

          {/* Where does this go? */}
          <div className="space-y-2">
            <Label className="text-xs text-zinc-400 uppercase tracking-wider">Post to</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['general', 'channel'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => form.setValue('postType', type)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-medium',
                    postType === type
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-zinc-800 hover:border-zinc-600 text-zinc-400',
                  )}
                >
                  {type === 'general' ? <Globe className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
                  <span>{type === 'general' ? 'Main Feed' : 'My Channel'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Upload button */}
          <Button
            type="submit"
            className="w-full gap-2 h-12 text-base"
            disabled={!file || uploadStore.status === 'uploading'}
          >
            <UploadCloud className="h-5 w-5" />
            {uploadStore.status === 'uploading' ? `Uploading ${uploadStore.progress}%…` : 'Upload & Publish'}
          </Button>

          {uploadError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
=======
      <StepBar current={step} goTo={(s) => { if (file || s === 'file') setStep(s) }} />

      {/* ── STEP 1: FILE SELECTION ──────────────────────────────────────── */}
      {step === 'file' && (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-2xl cursor-pointer transition-all group',
            'flex flex-col items-center justify-center text-center py-24 px-6',
            isDragActive
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-zinc-700 hover:border-primary/50 hover:bg-zinc-900/30',
          )}
        >
          <input {...getInputProps()} />
          <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
            <UploadCloud className="h-10 w-10 text-primary" />
          </div>
          <p className="text-xl font-bold mb-1">
            {isDragActive ? 'Drop your video' : 'Drop a video to get started'}
          </p>
          <p className="text-zinc-500 text-sm mb-6">or click to browse files</p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            {['MP4', 'MOV', 'MKV', 'WebM'].map(fmt => (
              <span key={fmt} className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 font-mono">{fmt}</span>
            ))}
            <span className="text-zinc-700 mx-1">·</span>
            <span className="text-zinc-600">Up to 20 GB / 4 hrs</span>
          </div>
          {dropError && (
            <div className="mt-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs max-w-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />{dropError}
>>>>>>> 6020e75 (redesign: unified Creator Studio upload flow)
            </div>
          )}
        </div>
      )}

<<<<<<< HEAD
        {/* ── RIGHT: metadata form ──────────────────────────────────────── */}
        <div className="space-y-8">

          <Section icon={Film} title="Content Details">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="My delicious ramen recipe"
                {...form.register('title')}
                className="mt-1.5"
              />
              {form.formState.errors.title && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Tell viewers what this video is about — the story, the ingredients, the inspiration…"
                rows={5}
                {...form.register('description')}
                className="mt-1.5 resize-none"
              />
            </div>

            <div>
              <Label htmlFor="tags" className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> Tags
              </Label>
              <Input
                id="tags"
                placeholder="ramen, japanese food, cooking (comma-separated)"
                {...form.register('tags')}
                className="mt-1.5"
              />
              <p className="text-xs text-zinc-500 mt-1">Separate with commas — helps viewers discover your content</p>
            </div>
          </Section>

          {postType === 'channel' && (
            <Section icon={Tv} title="Channel">
              {channels.length === 0 ? (
                <div className="p-4 rounded-xl bg-zinc-800/60 text-sm text-zinc-400">
                  You don't have a channel yet.{' '}
                  <a href="/studio/channel/new" className="text-primary hover:underline">Create one</a>{' '}
                  or switch to <strong>Main Feed</strong>.
                </div>
              ) : (
                <Select onValueChange={(v) => form.setValue('channelId', v)} defaultValue={channels[0]?.id}>
                  <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                  <SelectContent>
                    {channels.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Section>
          )}

          <Section icon={Eye} title="Publishing">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Visibility</Label>
                <Select onValueChange={(v) => form.setValue('visibility', v as 'public' | 'private' | 'unlisted')} defaultValue="public">
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">🌍 Public</SelectItem>
                    <SelectItem value="unlisted">🔗 Unlisted (link only)</SelectItem>
                    <SelectItem value="private">🔒 Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Monetization</Label>
                {isCreator ? (
                  <Select onValueChange={(v) => form.setValue('pricingModel', v as 'free' | 'pay_per_view' | 'subscription')} defaultValue="free">
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="pay_per_view">Pay Per View</SelectItem>
                      <SelectItem value="subscription">Subscribers Only</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1.5 px-3 py-2.5 rounded-lg border border-zinc-700 bg-zinc-800/40 text-sm text-zinc-400">
                    Free only —{' '}
                    <a href="/creator/chef-verification" className="text-primary hover:underline">apply for Creator</a> to unlock monetization
                  </div>
                )}
              </div>
            </div>
          </Section>

          {isCreator && pricingModel === 'pay_per_view' && (
            <Section icon={DollarSign} title="Price">
              <div className="max-w-xs">
                <Label htmlFor="price">Price (USD)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0.50"
                  placeholder="4.99"
                  {...form.register('price')}
                  className="mt-1.5"
                />
              </div>
            </Section>
          )}
        </div>
      </div>
    </form>
=======
      {/* ── STEP 2: TRIM / CLIP ─────────────────────────────────────────── */}
      {step === 'trim' && file && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crop className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-bold">Trim your video</h2>
                <p className="text-xs text-zinc-500">Choose the best part — or skip to use the full thing</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setStep('file') }} className="text-zinc-500">
                <X className="h-4 w-4 mr-1" /> Discard
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setClip(null); setStep('details') }}>
                Skip trim <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
            <VideoEditor
              file={file}
              onClipSelected={(s, e, d) => { setClip({ startTime: s, endTime: e, duration: d }); setStep('details') }}
              onCancel={() => { setFile(null); setStep('file') }}
            />
          </div>
        </div>
      )}

      {/* ── STEP 3: DETAILS ─────────────────────────────────────────────── */}
      {step === 'details' && file && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* LEFT: File info */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Film className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-sm truncate">{file.name}</p>
                <p className="text-xs text-zinc-500">{videoDuration}</p>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">{fileSizeLabel}</span>
                  <span className="text-[11px] text-zinc-600">~{fileTimeLabel} to upload</span>
                </div>
              </div>
              {file.size > 8 * 1024 ** 3 && (
                <p className="text-[11px] text-amber-400/70 leading-snug">
                  Large file — upload continues in the background.
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setStep('trim')}>
                  <Scissors className="h-3 w-3 mr-1" /> Re-trim
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-400"
                  onClick={() => { setFile(null); setStep('file') }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {preselectedStation && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-sm">
                <span className="text-primary font-medium">📡</span>
                <span className="text-xs font-semibold">{preselectedStation.name}</span>
              </div>
            )}

            {/* Post destination */}
            <div className="space-y-2">
              <Label className="text-[11px] text-zinc-500 uppercase tracking-widest">Post to</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['general', 'channel'] as const).map((type) => (
                  <button key={type} type="button" onClick={() => setPostType(type)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-medium',
                      postType === type
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-zinc-800 hover:border-zinc-600 text-zinc-500',
                    )}>
                    {type === 'general' ? <Globe className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
                    <span>{type === 'general' ? 'Main Feed' : 'My Channel'}</span>
                  </button>
                ))}
              </div>
            </div>

            {postType === 'channel' && channels.length > 0 && (
              <div>
                <Label className="text-[11px] text-zinc-500 uppercase tracking-widest">Channel</Label>
                <Select onValueChange={setChannelId} defaultValue={channels[0]?.id}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {channels.map(ch => <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Upload button */}
            <Button onClick={handleUpload}
              disabled={!title.trim() || uploadStore.status === 'uploading'}
              className="w-full gap-2 h-12 text-base mt-2">
              <UploadCloud className="h-5 w-5" />
              {uploadStore.status === 'uploading' ? `Uploading ${uploadStore.progress}%` : 'Publish video'}
            </Button>

            {uploadStore.status === 'error' && uploadStore.error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{uploadStore.error}</span>
              </div>
            )}
          </div>

          {/* RIGHT: Form */}
          <div className="space-y-7">
            {/* Title */}
            <div>
              <Label htmlFor="title" className="text-sm font-semibold">Title <span className="text-red-400">*</span></Label>
              <Input id="title" value={title} onChange={e => { setTitle(e.target.value); setTitleError(null) }}
                placeholder="Give your video a clear, descriptive title"
                className={cn('mt-1.5 text-base', titleError ? 'border-red-500' : '')} />
              {titleError && <p className="text-red-400 text-xs mt-1">{titleError}</p>}
              <p className="text-xs text-zinc-600 mt-1">{title.length} / 100</p>
            </div>

            {/* Description + Tags row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <Label htmlFor="desc" className="text-sm font-semibold">Description</Label>
                <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What's this video about? Ingredients, story, tips..."
                  rows={4} className="mt-1.5 resize-none" />
              </div>
              <div className="space-y-5">
                <div>
                  <Label htmlFor="tags" className="text-sm font-semibold flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" /> Tags
                  </Label>
                  <Input id="tags" value={tags} onChange={e => setTags(e.target.value)}
                    placeholder="ramen, japanese, cooking"
                    className="mt-1.5" />
                  <p className="text-[11px] text-zinc-600 mt-1">Comma-separated</p>
                </div>

                {/* Visibility */}
                <div>
                  <Label className="text-sm font-semibold">Visibility</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {[
                      { value: 'public' as const, icon: Globe, label: 'Public' },
                      { value: 'unlisted' as const, icon: Share2, label: 'Unlisted' },
                      { value: 'private' as const, icon: Lock, label: 'Private' },
                    ].map(opt => (
                      <button key={opt.value} type="button" onClick={() => setVisibility(opt.value)}
                        className={cn(
                          'flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all',
                          visibility === opt.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-zinc-800 hover:border-zinc-600 text-zinc-500',
                        )}>
                        <opt.icon className="h-4 w-4" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pricing */}
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" /> Pricing
                  </Label>
                  {isCreator ? (
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      {[
                        { value: 'free' as const, label: 'Free' },
                        { value: 'pay_per_view' as const, label: 'Pay per view' },
                        { value: 'subscription' as const, label: 'Subscribers' },
                      ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => setPricingModel(opt.value)}
                          className={cn(
                            'p-2.5 rounded-xl border text-xs font-medium transition-all',
                            pricingModel === opt.value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-zinc-800 hover:border-zinc-600 text-zinc-500',
                          )}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1.5 px-3 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50 text-xs text-zinc-500">
                      Free — <a href="/creator/chef-verification" className="text-primary hover:underline">become a Creator</a> to monetize
                    </div>
                  )}
                  {pricingModel === 'pay_per_view' && isCreator && (
                    <div className="mt-2">
                      <Input type="number" step="0.01" min="0.50" placeholder="4.99" value={price}
                        onChange={e => setPrice(e.target.value)} className="max-w-[140px]" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <Button type="button" variant="ghost" onClick={() => setStep('trim')} className="text-zinc-500">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back to trim
              </Button>
              <Button onClick={handleUpload} disabled={!title.trim() || uploadStore.status === 'uploading'}
                className="gap-2 h-11 px-6">
                <UploadCloud className="h-4 w-4" />
                {uploadStore.status === 'uploading' ? 'Uploading...' : 'Publish'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
>>>>>>> 6020e75 (redesign: unified Creator Studio upload flow)
  )
}
