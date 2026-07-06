'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  UploadCloud, Film, AlertCircle, X, Globe, Tv, Scissors,
  GraduationCap, Wand2, Tag, Eye, DollarSign, ArrowRight, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import VideoEditor from './VideoEditor'
import { useUploadStore } from '@/lib/upload-store'

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

interface Channel { id: string; name: string; slug: string }
interface Station { id: string; name: string }

interface UploadStudioProps {
  channels: Channel[]
  preselectedStation?: Station | null
  isCreator?: boolean
}

type Step = 'drop' | 'edit' | 'meta' | 'started'

interface ClipInfo { startTime: number; endTime: number; duration: number }

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
export default function UploadStudio({ channels, preselectedStation, isCreator = false }: UploadStudioProps) {
  const router = useRouter()
  const uploadStore = useUploadStore()

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

  const onDrop = useCallback((accepted: File[]) => {
    setDropError(null)
    const f = accepted[0]
    if (!f) return
    if (f.size > MAX_UPLOAD_BYTES) {
      setDropError(`File is ${formatBytes(f.size)} — max supported size is 20 GB. Please compress or trim before uploading.`)
      return
    }
    setFile(f); setClip(null); setStep('edit')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': [] },
    maxFiles: 1,
    disabled: step !== 'drop',
  })

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
        </div>
      </div>
    )
  }

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
            </div>
          )}
        </div>

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
  )
}
