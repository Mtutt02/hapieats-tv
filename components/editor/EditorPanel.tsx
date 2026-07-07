'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Scissors, Type, Music, Mic, Sticker, Monitor, Lock, Crown, Sparkles, Check, Palette, Image } from 'lucide-react'
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
  file: File
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
): TimelineTrack[] {
  const tracks: TimelineTrack[] = []

  // Video track
  const videoClips: TimelineClip[] = [{
    id: 'main-video',
    type: 'video',
    label: 'Main Video',
    startTime: clipStart,
    endTime: clipEnd,
  }]
  tracks.push({
    id: 'track-video',
    label: 'Video',
    type: 'video',
    icon: '🎬',
    clips: videoClips,
    color: '#3b82f6',
  })

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

export default function EditorPanel({ file, onComplete, onCancel }: EditorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('trim')
  const [clipStart, setClipStart] = useState(0)
  const [clipEnd, setClipEnd] = useState(0)
  const [duration, setDuration] = useState(0)
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

  // Create blob URL for the file
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

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
    if (clipId === 'main-video') return // Can't delete the main video

    // Check if it's a text or emoji overlay
    const overlayToRemove = overlays.find(o => o.id === clipId)
    if (overlayToRemove) {
      setOverlays(prev => prev.filter(o => o.id !== clipId))
      return
    }

    // Check if it's music
    if (clipId === 'music-clip') {
      setSelectedTrack(null)
      return
    }

    // Check if it's voiceover
    if (clipId === 'voice-clip') {
      setVoiceoverBlob(null)
      return
    }
  }, [overlays])

  // Build timeline tracks from current state
  const timelineTracks = buildTimelineTracks(overlays, selectedTrack, voiceoverBlob, clipStart, clipEnd)

  const handleDone = () => {
    onComplete({
      clipStart,
      clipEnd,
      overlays,
      musicTrack: selectedTrack,
      voiceoverBlob,
    })
  }

  return (
    <div className="space-y-3">
      {/* Hidden video for metadata + playback */}
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          className="hidden"
          onLoadedMetadata={handleMetadata}
          onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          playsInline
        />
      )}

      {/* SPLIT LAYOUT: Video preview (left) + Controls (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3">
        {/* LEFT: Video Preview with draggable overlays */}
        {videoUrl && (
          <div className="rounded-xl border border-zinc-800 bg-black overflow-hidden relative">
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
            {/* Overlay drag hint */}
            {overlays.length > 0 && (
              <div className="absolute top-2 left-2 right-2 flex justify-center pointer-events-none">
                <span className="text-[10px] bg-black/60 text-zinc-400 px-2 py-1 rounded-full">
                  {overlays.length} overlay{overlays.length !== 1 ? 's' : ''} — click timeline to edit
                </span>
              </div>
            )}
          </div>
        )}

        {/* RIGHT: Tab bar + panel content */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col h-full min-h-[400px]">
          {/* Tab bar */}
          <div className="flex gap-0.5 p-1 bg-zinc-900 border-b border-zinc-800 flex-wrap">
            {TABS.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[10px] font-medium transition-all',
                    isActive
                      ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50',
                    tab.premium && !isActive && 'opacity-60'
                  )}
                  title={tab.label}
                >
                  {tab.premium && !isActive ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline text-[10px]">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Active tab content - scrollable */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {activeTab === 'trim' && (
              <TrimPanel
                file={file}
                clipStart={clipStart}
                clipEnd={clipEnd}
                onTrimChange={(s, e) => { setClipStart(s); setClipEnd(e) }}
              />
            )}

            {activeTab === 'text' && (
              <TextOverlayPanel
                overlays={overlays}
                onOverlaysChange={setOverlays}
                videoDuration={duration}
              />
            )}

            {activeTab === 'music' && (
              <MusicPanel
                selectedTrack={selectedTrack}
                onTrackSelect={setSelectedTrack}
              />
            )}

            {activeTab === 'voice' && (
              <VoiceOverPanel
                blob={voiceoverBlob}
                onBlobChange={setVoiceoverBlob}
              />
            )}

            {activeTab === 'stickers' && (
              <StickerPanel
                overlays={overlays}
                onOverlaysChange={setOverlays}
                videoDuration={duration}
              />
            )}

            {activeTab === 'filters' && (
              <FilterPanel
                filters={filters}
                onFiltersChange={setFilters}
                videoUrl={videoUrl || ''}
              />
            )}

            {activeTab === 'background' && (
              <PremiumGate
                feature="Background Removal"
                description="Remove video backgrounds with AI-powered segmentation. Perfect for professional cooking tutorials and food content."
              >
                <BackgroundRemoval file={file} />
              </PremiumGate>
            )}
          </div>
        </div>
      </div>

      {/* TIMELINE - always visible at bottom */}
      {videoUrl && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
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

      {/* Thumbnail picker */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <ThumbnailPicker
          videoUrl={videoUrl || ''}
          duration={duration}
          thumbnail={thumbnail}
          onThumbnailChange={setThumbnail}
        />
      </div>
      {/* End split layout */}

      {/* Overlay summary badges */}
      {(overlays.length > 0 || selectedTrack || voiceoverBlob || filters.preset) && (
        <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
          {overlays.length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              {overlays.length} overlay{overlays.length !== 1 ? 's' : ''}
            </span>
          )}
          {selectedTrack && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">
              🎵 Music added
            </span>
          )}
          {voiceoverBlob && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">
              🎤 Voice over
            </span>
          )}
          {filters.preset && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              ✨ {filters.preset} filter
            </span>
          )}
          {thumbnail && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">
              📸 Thumbnail set
            </span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 sticky bottom-0 bg-zinc-950 py-3 border-t border-zinc-800 -mx-4 -mb-4 px-4">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1 gap-2" onClick={handleDone}>
          <Check className="h-4 w-4" />
          Done Editing
        </Button>
      </div>
    </div>
  )
}
