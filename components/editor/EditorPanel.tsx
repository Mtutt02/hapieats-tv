import { useState, useRef, useEffect, useCallback } from 'react'
import { Scissors, Type, Music, Mic, Sticker, Monitor, Lock, Crown, Sparkles, Check, Palette, Image, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import TrimPanel from './TrimPanel'
import TextOverlayPanel from './TextOverlayPanel'
import MusicPanel from './MusicPanel'
import VoiceOverPanel from './VoiceOverPanel'
import StickerPanel from './StickerPanel'
import BackgroundRemoval from './BackgroundRemoval'
import PremiumGate from './PremiumGate'
import VideoPreview from './VideoPreview'
import Timeline from './Timeline'
import FilterPanel from './FilterPanel'
import ThumbnailPicker from './ThumbnailPicker'
import type { EditorOutput, Overlay, FilterSettings, TimelineTrack, TimelineClip, VideoClip } from './types'
import { DEFAULT_FILTERS } from './types'

interface EditorPanelProps {
  files: File[]
  onComplete: (output: EditorOutput) => void
  onCancel: () => void
}

type TabId = 'trim' | 'text' | 'music' | 'voice' | 'stickers' | 'filters' | 'background'

interface Tab {
  id: TabId
  label: string
  icon: React.ElementType
  premium?: boolean
}

const TABS: Tab[] = [
  { id: 'trim', label: 'Trim', icon: Scissors },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'stickers', label: 'Stickers', icon: Sticker },
  { id: 'filters', label: 'Filters', icon: Palette },
  { id: 'background', label: 'Background', icon: Monitor, premium: true },
]

function buildTimelineTracks(
  overlays: Overlay[],
  selectedTrack: string | null,
  voiceoverBlob: Blob | null,
  clipStart: number,
  clipEnd: number,
  clips: VideoClip[],
): TimelineTrack[] {
  const tracks: TimelineTrack[] = []

  // Video track - all clips
  const videoClips: TimelineClip[] = clips.length > 0
    ? clips.map(c => ({
        id: c.id,
        type: 'video' as const,
        label: c.file?.name || 'Clip',
        startTime: c.startTime || 0,
        endTime: c.endTime || clipEnd,
        data: c,
      }))
    : (clipEnd > 0 ? [{
        id: 'main-video',
        type: 'video' as const,
        label: 'Main Video',
        startTime: clipStart,
        endTime: clipEnd,
      }] : [])
  if (videoClips.length > 0) {
    tracks.push({
      id: 'track-video',
      label: 'Video',
      type: 'video',
      icon: '🎬',
      clips: videoClips,
      color: '#3b82f6',
    })
  }

  // Text overlays track
  const textClips: TimelineClip[] = overlays
    .filter(o => o.type === 'text')
    .map(o => ({
      id: o.id,
      type: 'text' as const,
      label: o.content.substring(0, 20),
      startTime: o.startTime,
      endTime: o.endTime,
      data: o,
    }))
  if (textClips.length > 0) {
    tracks.push({
      id: 'track-text',
      label: 'Text',
      type: 'text',
      icon: '📝',
      clips: textClips,
      color: '#c9a84c',
    })
  }

  // Sticker overlays track
  const stickerClips: TimelineClip[] = overlays
    .filter(o => o.type === 'emoji')
    .map(o => ({
      id: o.id,
      type: 'sticker' as const,
      label: o.content,
      startTime: o.startTime,
      endTime: o.endTime,
      data: o,
    }))
  if (stickerClips.length > 0) {
    tracks.push({
      id: 'track-stickers',
      label: 'Stickers',
      type: 'sticker',
      icon: '🌟',
      clips: stickerClips,
      color: '#a855f7',
    })
  }

  // Music track
  if (selectedTrack) {
    tracks.push({
      id: 'track-music',
      label: 'Music',
      type: 'music',
      icon: '🎵',
      clips: [{
        id: 'music-clip',
        type: 'music',
        label: selectedTrack,
        startTime: 0,
        endTime: clipEnd,
      }],
      color: '#22c55e',
    })
  }

  // Voiceover track
  if (voiceoverBlob) {
    tracks.push({
      id: 'track-voice',
      label: 'Voice Over',
      type: 'voice',
      icon: '🎤',
      clips: [{
        id: 'voice-clip',
        type: 'voice',
        label: 'Recording',
        startTime: 0,
        endTime: clipEnd,
      }],
      color: '#f97316',
    })
  }

  return tracks
}

export default function EditorPanel({ files, onComplete, onCancel }: EditorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('trim')
  const [clipStart, setClipStart] = useState(0)
  const [clipEnd, setClipEnd] = useState(0)
  const [duration, setDuration] = useState(0)
  const [clips, setClips] = useState<VideoClip[]>([])
  const [overlays, setOverlays] = useState<Overlay[]>([])
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)
  const [voiceoverBlob, setVoiceoverBlob] = useState<Blob | null>(null)
  const [filters, setFilters] = useState<FilterSettings>(DEFAULT_FILTERS)
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [timelineZoom, setTimelineZoom] = useState(2)

  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  // Create blob URLs for all files and initialize clips
  useEffect(() => {
    const initialClips: VideoClip[] = files.map((f, i) => ({
      id: `clip-${i + 1}`,
      file: f,
      url: URL.createObjectURL(f),
      startTime: 0,
      endTime: 0,
    }))
    setClips(initialClips)
    setVideoUrl(initialClips[0]?.url || null)
    return () => {
      initialClips.forEach(c => URL.revokeObjectURL(c.url))
    }
  }, [files])

  const handleMetadata = () => {
    if (!videoRef.current) return
    const d = videoRef.current.duration
    setDuration(d)
    setClipEnd(d)
  }

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time)
    // Loop playback within clip range
    if (videoRef.current && time >= clipEnd && isPlaying) {
      videoRef.current.currentTime = clipStart
      setCurrentTime(clipStart)
    }
  }, [clipStart, clipEnd, isPlaying])

  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      if (videoRef.current.currentTime >= clipEnd || videoRef.current.currentTime < clipStart) {
        videoRef.current.currentTime = clipStart
      }
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying, clipStart, clipEnd])

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time)
    if (videoRef.current) {
      videoRef.current.currentTime = time
    }
  }, [])

  const handleDeleteClip = useCallback((trackId: string, clipId: string) => {
    if (clipId === 'main-video') return
    const overlayToRemove = overlays.find(o => o.id === clipId)
    if (overlayToRemove) {
      setOverlays(prev => prev.filter(o => o.id !== clipId))
      return
    }
    if (clipId === 'music-clip') { setSelectedTrack(null); return }
    if (clipId === 'voice-clip') { setVoiceoverBlob(null); return }
  }, [overlays])

  const timelineTracks = buildTimelineTracks(overlays, selectedTrack, voiceoverBlob, clipStart, clipEnd, clips)

  const handleDone = () => {
    onComplete({ clipStart, clipEnd, overlays, musicTrack: selectedTrack, voiceoverBlob })
  }

  const TabContent = () => {
    switch (activeTab) {
      case 'trim':
        return <TrimPanel file={files[0]} clipStart={clipStart} clipEnd={clipEnd} onTrimChange={(s, e) => { setClipStart(s); setClipEnd(e) }} />
      case 'text':
        return <TextOverlayPanel overlays={overlays} onOverlaysChange={setOverlays} videoDuration={duration} />
      case 'music':
        return <MusicPanel selectedTrack={selectedTrack} onTrackSelect={setSelectedTrack} />
      case 'voice':
        return <VoiceOverPanel blob={voiceoverBlob} onBlobChange={setVoiceoverBlob} />
      case 'stickers':
        return <StickerPanel overlays={overlays} onOverlaysChange={setOverlays} videoDuration={duration} />
      case 'filters':
        return <FilterPanel filters={filters} onFiltersChange={setFilters} videoUrl={videoUrl || ''} />
      case 'background':
        return (
          <PremiumGate feature="Background Removal" description="Remove video backgrounds with AI-powered segmentation.">
            <BackgroundRemoval file={files[0]} />
          </PremiumGate>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-3 p-3 sm:p-4 max-w-7xl mx-auto">
      {/* LEFT: Video preview + timeline (visible at all times) */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Single video preview */}
        {videoUrl && (
          <div className="rounded-xl border border-zinc-800 bg-black overflow-hidden relative aspect-video lg:aspect-auto lg:min-h-[400px]">
            <div className="absolute inset-0">
              <VideoPreview
                videoUrl={videoUrl}
                overlays={overlays}
                filters={filters}
                currentTime={currentTime}
                isPlaying={isPlaying}
                duration={duration}
                onTimeUpdate={handleTimeUpdate}
                onPlayPause={handlePlayPause}
              />
            </div>
            {overlays.length > 0 && (
              <div className="absolute top-2 left-2 right-2 flex justify-center pointer-events-none z-10">
                <span className="text-[10px] bg-black/60 text-zinc-400 px-2 py-1 rounded-full">
                  {overlays.length} overlay{overlays.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Timeline — always visible below video */}
        {videoUrl && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 sm:p-3 overflow-x-auto">
            <Timeline
              tracks={timelineTracks}
              duration={clipEnd}
              currentTime={currentTime}
              onSeek={handleSeek}
              onDeleteClip={handleDeleteClip}
              zoom={timelineZoom}
              onZoomChange={setTimelineZoom}
            />
          </div>
        )}

        {/* Hidden video element for playback */}
        <video
          ref={videoRef}
          src={videoUrl || ''}
          className="hidden"
          onLoadedMetadata={handleMetadata}
          onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          playsInline
        />
      </div>

      {/* RIGHT: Tools panel — side-by-side on desktop, full-width below on mobile */}
      <div className="w-full lg:w-[340px] xl:w-[380px] shrink-0">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col max-h-[50vh] lg:max-h-[calc(100vh-12rem)]">
          {/* Tab bar */}
          <div className="flex gap-0.5 p-1 bg-zinc-900 border-b border-zinc-800 overflow-x-auto scrollbar-none">
            {TABS.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center justify-center gap-1 py-2 px-2.5 rounded-lg text-xs font-medium transition-all shrink-0',
                    isActive
                      ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50',
                    tab.premium && !isActive && 'opacity-60'
                  )}
                  title={tab.label}
                >
                  {tab.premium && !isActive ? <Lock className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  <span className="text-[11px] hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Tab content — scrollable */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <TabContent />
          </div>
        </div>

        {/* Overlay badges */}
        {(overlays.length > 0 || selectedTrack || voiceoverBlob || filters.preset) && (
          <div className="flex flex-wrap gap-1.5 mt-2 p-2 rounded-lg bg-zinc-900/50 border border-zinc-800">
            {overlays.length > 0 && <span className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">{overlays.length} overlay{overlays.length !== 1 ? 's' : ''}</span>}
            {selectedTrack && <span className="text-[10px] px-2 py-1 rounded-full bg-zinc-800 text-zinc-300">🎵 Music</span>}
            {voiceoverBlob && <span className="text-[10px] px-2 py-1 rounded-full bg-zinc-800 text-zinc-300">🎤 Voice</span>}
            {filters.preset && <span className="text-[10px] px-2 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">✨ {filters.preset}</span>}
            {thumbnail && <span className="text-[10px] px-2 py-1 rounded-full bg-zinc-800 text-zinc-300">📸 Thumbnail</span>}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          <input type="file" accept="video/*" id="add-clip-input" className="hidden" onChange={e => {
            const f = e.target.files?.[0]
            if (!f) return
            const id = `clip-${clips.length + 1}-${Date.now()}`
            const url = URL.createObjectURL(f)
            setClips(prev => [...prev, { id, file: f, url, startTime: 0, endTime: 0 }])
            e.target.value = ''
          }} />
          <Button variant="outline" onClick={onCancel} size="sm">Cancel</Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => document.getElementById('add-clip-input')?.click()}>
            <Plus className="h-3.5 w-3.5" /> Clip
          </Button>
          <div className="flex-1" />
          <Button size="sm" className="gap-1.5" onClick={handleDone}>
            <Check className="h-3.5 w-3.5" /> Done
          </Button>
        </div>
      </div>

      {/* Thumbnail picker — below both columns */}
      <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 sm:p-4">
        <ThumbnailPicker
          videoUrl={videoUrl || ''}
          duration={duration}
          thumbnail={thumbnail}
          onThumbnailChange={setThumbnail}
        />
      </div>
    </div>
  )
}
