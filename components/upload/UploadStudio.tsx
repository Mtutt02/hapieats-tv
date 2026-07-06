'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import {
  UploadCloud, Film, AlertCircle, X, Globe, Tv,
  Scissors, Wand2, Tag, Eye, DollarSign, ArrowRight, CheckCircle2,
  ChevronLeft, ChevronRight, Clock, Sparkles, Share2, Lock,
  Hash, Image, Music, Crop,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import VideoEditor from './VideoEditor'
import { useUploadStore } from '@/lib/upload-store'

interface Channel { id: string; name: string; slug: string }
interface Station { id: string; name: string }

interface UploadStudioProps {
  channels: Channel[]
  preselectedStation?: Station | null
  isCreator?: boolean
}

interface ClipInfo { startTime: number; endTime: number; duration: number }

type Step = 'file' | 'trim' | 'details' | 'uploading' | 'done'

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

function uploadEstimate(bytes: number): string {
  const seconds = bytes / (2.5 * 1024 * 1024)
  if (seconds < 60) return 'under a minute'
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min`
  return `~${(seconds / 3600).toFixed(1)} hr`
}

const MAX_UPLOAD_BYTES = 20 * 1024 ** 3

const STEPS = [
  { id: 'file' as Step, label: 'Select', icon: Film },
  { id: 'trim' as Step, label: 'Trim', icon: Scissors },
  { id: 'details' as Step, label: 'Details', icon: Sparkles },
  { id: 'uploading' as Step, label: 'Upload', icon: UploadCloud },
]

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.id === current)
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const Icon = s.icon
        const isActive = i <= idx
        const isCurrent = s.id === current
        return (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all',
                isCurrent ? 'bg-primary/15 text-primary border border-primary/30' : '',
                isActive && !isCurrent ? 'text-zinc-400' : '',
                !isActive ? 'text-zinc-700' : '',
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', isCurrent ? 'text-primary' : '')} />
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-px mx-2', i < idx ? 'bg-primary/40' : 'bg-zinc-800')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function UploadStudio({ channels, preselectedStation, isCreator = false }: UploadStudioProps) {
  const router = useRouter()
  const uploadStore = useUploadStore()

  const [step, setStep] = useState<Step>('file')
  const [file, setFile] = useState<File | null>(null)
  const [clip, setClip] = useState<ClipInfo | null>(null)
  const [dropError, setDropError] = useState<string | null>(null)
  const [stationId] = useState<string | null>(preselectedStation?.id ?? null)
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private' | 'unlisted'>('public')
  const [pricingModel, setPricingModel] = useState<'free' | 'pay_per_view' | 'subscription'>('free')
  const [price, setPrice] = useState('')
  const [postType, setPostType] = useState<'general' | 'channel'>('general')
  const [channelId, setChannelId] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    setDropError(null)
    const f = accepted[0]
    if (!f) return
    if (f.size > MAX_UPLOAD_BYTES) {
      setDropError(`File is ${formatBytes(f.size)} — 20 GB max.`)
      return
    }
    setFile(f)
    setClip(null)
    setStep('trim')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': [] },
    maxFiles: 1,
    disabled: step !== 'file',
  })

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

  const fileSizeLabel = file ? formatBytes(file.size) : ''
  const fileTimeLabel = file ? uploadEstimate(file.size) : ''
  const videoDuration = clip
    ? `Clipped: ${formatDuration(clip.startTime)} — ${formatDuration(clip.endTime)} (${Math.floor(clip.duration / 60)}:${String(Math.floor(clip.duration % 60)).padStart(2, '0')})`
    : 'Full video'

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
              {title} is uploading. You can navigate away.
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
              <Button variant="outline" onClick={() => { setFile(null); setStep('file'); setTitle(''); setDescription(''); setTags('') }}>
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
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Wand2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">HapiEats Creator Studio</h1>
          <p className="text-xs text-zinc-500">Upload, trim, and publish your food content</p>
        </div>
      </div>

      <StepBar current={step} />

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
            </div>
          )}
        </div>
      )}

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

      {step === 'details' && file && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
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
                <p className="text-[11px] text-amber-400/70">Large file — upload continues in the background.</p>
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

          <div className="space-y-7">
            <div>
              <Label htmlFor="title" className="text-sm font-semibold">Title <span className="text-red-400">*</span></Label>
              <Input id="title" value={title} onChange={e => { setTitle(e.target.value); setTitleError(null) }}
                placeholder="Give your video a clear, descriptive title"
                className={cn('mt-1.5 text-base', titleError ? 'border-red-500' : '')} />
              {titleError && <p className="text-red-400 text-xs mt-1">{titleError}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <Label htmlFor="desc" className="text-sm font-semibold">Description</Label>
                <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What's this video about? Ingredients, story, tips…"
                  rows={4} className="mt-1.5 resize-none" />
              </div>
              <div className="space-y-5">
                <div>
                  <Label htmlFor="tags" className="text-sm font-semibold flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" /> Tags
                  </Label>
                  <Input id="tags" value={tags} onChange={e => setTags(e.target.value)}
                    placeholder="ramen, japanese, cooking" className="mt-1.5" />
                  <p className="text-[11px] text-zinc-600 mt-1">Comma-separated</p>
                </div>

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
  )
}
