'use client'

import { useState, useRef, useCallback } from 'react'
import { Search, Play, Pause, Music, Upload, Volume2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MUSIC_LIBRARY, GENRES, generateTrackAudio } from './music-data'

interface MusicPanelProps {
  selectedTrack: string | null
  onTrackSelect: (trackId: string | null) => void
}

export default function MusicPanel({ selectedTrack, onTrackSelect }: MusicPanelProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const generatedUrlsRef = useRef<Map<string, string>>(new Map())
  const [volume, setVolume] = useState(0.7)
  const [customFile, setCustomFile] = useState<File | null>(null)

  const filteredTracks = MUSIC_LIBRARY.filter(t => {
    if (selectedGenre && t.genre !== selectedGenre) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return t.name.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q)
    }
    return true
  })

  const previewTrack = useCallback(async (track: typeof MUSIC_LIBRARY[0]) => {
    if (playingId === track.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }

    audioRef.current?.pause()

    // Check if we already generated audio for this track
    let url = generatedUrlsRef.current.get(track.id)
    if (!url) {
      setGeneratingId(track.id)
      // Generate audio (wrap in setTimeout to let UI update)
      await new Promise(resolve => setTimeout(resolve, 50))
      url = generateTrackAudio(track)
      generatedUrlsRef.current.set(track.id, url)
      setGeneratingId(null)
    }

    const audio = new Audio(url)
    audio.volume = volume
    audio.play()
    audio.onended = () => setPlayingId(null)
    audioRef.current = audio
    setPlayingId(track.id)
  }, [playingId, volume])

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
  }

  const handleCustomUpload = () => {
    if (!customFile) return
    onTrackSelect('custom-' + customFile.name)
  }

  const selectedTrackData = selectedTrack
    ? MUSIC_LIBRARY.find(t => t.id === selectedTrack)
    : null

  // Cleanup generated URLs on unmount
  const cleanup = () => {
    generatedUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    generatedUrlsRef.current.clear()
  }

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-all border',
            activeTab === 'library'
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
          )}
        >
          Built-in Library
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-all border',
            activeTab === 'upload'
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
          )}
        >
          Custom Upload
        </button>
      </div>

      {activeTab === 'library' && (
        <>
          {/* Search + genre filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tracks..."
                className="pl-9 text-sm"
              />
            </div>
          </div>

          {/* Genre pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedGenre(null)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs border transition-all',
                !selectedGenre
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
              )}
            >
              All
            </button>
            {GENRES.map(genre => (
              <button
                key={genre}
                type="button"
                onClick={() => setSelectedGenre(selectedGenre === genre ? null : genre)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs border transition-all',
                  selectedGenre === genre
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
                )}
              >
                {genre}
              </button>
            ))}
          </div>

          {/* Track list */}
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {filteredTracks.map(track => (
              <div
                key={track.id}
                className={cn(
                  'flex items-center gap-3 p-2.5 rounded-xl border transition-all',
                  selectedTrack === track.id
                    ? 'border-primary bg-primary/5'
                    : 'border-zinc-800 hover:bg-zinc-900/80'
                )}
              >
                <button
                  type="button"
                  onClick={() => previewTrack(track)}
                  className="h-9 w-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 hover:bg-zinc-700 transition-colors relative"
                >
                  {generatingId === track.id ? (
                    <span className="h-4 w-4 block rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
                  ) : playingId === track.id ? (
                    <Pause className="h-4 w-4 text-primary" />
                  ) : (
                    <Play className="h-4 w-4 text-zinc-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{track.name}</p>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span>{track.genre}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-700" />
                    <span>{track.duration}</span>
                  </div>
                </div>

                <Button
                  variant={selectedTrack === track.id ? 'default' : 'ghost'}
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => onTrackSelect(selectedTrack === track.id ? null : track.id)}
                >
                  {selectedTrack === track.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Music className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
            {filteredTracks.length === 0 && (
              <p className="text-center text-zinc-600 text-sm py-8">No tracks found</p>
            )}
          </div>
        </>
      )}

      {activeTab === 'upload' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center">
            <Upload className="h-8 w-8 text-zinc-500 mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">Upload your own music</p>
            <p className="text-xs text-zinc-500 mb-4">MP3, WAV, or AAC (max 20 MB)</p>
            <input
              type="file"
              accept="audio/*"
              onChange={e => setCustomFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
            {customFile && (
              <div className="mt-3 flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-xs truncate flex-1 text-left">{customFile.name}</span>
                <Button size="sm" className="ml-2 h-7 text-xs" onClick={handleCustomUpload}>
                  Use
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected track info */}
      {selectedTrack && (
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                {selectedTrackData?.name || customFile?.name || selectedTrack}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onTrackSelect(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Volume2 className="h-3.5 w-3.5 text-zinc-500" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-800 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <span className="text-xs text-zinc-500 w-8 text-right">{Math.round(volume * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
