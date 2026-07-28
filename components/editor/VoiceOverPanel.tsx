'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Play, Pause, Volume2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface VoiceOverPanelProps {
  blob: Blob | null
  onBlobChange: (blob: Blob | null) => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0').padStart(5, '0')}`
}

export default function VoiceOverPanel({ blob, onBlobChange }: VoiceOverPanelProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Create URL when blob changes
  useEffect(() => {
    if (blob) {
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setAudioUrl(null)
    }
  }, [blob])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })

      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const recordedBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        onBlobChange(recordedBlob)
        stream.getTracks().forEach(t => t.stop())
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setRecordingDuration(0)

      timerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1)
      }, 1000)
    } catch {
      // User denied mic access or no mic available
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleClear = () => {
    audioRef.current?.pause()
    setIsPlaying(false)
    onBlobChange(null)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
  }

  return (
    <div className="space-y-5">
      {/* Record button area */}
      <div className="flex flex-col items-center gap-3 py-6">
        {isRecording ? (
          <>
            <button
              type="button"
              onClick={stopRecording}
              className="h-20 w-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center animate-pulse hover:bg-red-500/30 transition-colors"
            >
              <Square className="h-7 w-7 text-red-500 fill-red-500" />
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-lg font-mono font-bold text-red-400">
                {formatDuration(recordingDuration)}
              </span>
            </div>
            <p className="text-xs text-zinc-500">Recording... click stop when done</p>
          </>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            className={cn(
              'h-20 w-20 rounded-full border-2 flex items-center justify-center transition-all',
              blob
                ? 'border-primary bg-primary/10 hover:bg-primary/20'
                : 'border-zinc-700 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-500'
            )}
          >
            <Mic className={cn('h-8 w-8', blob ? 'text-primary' : 'text-zinc-400')} />
          </button>
        )}
      </div>

      {/* Recorded audio playback */}
      {audioUrl && !isRecording && (
        <div className="space-y-3 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full shrink-0"
              onClick={togglePlayback}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </Button>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Voice Over</p>
              <p className="text-xs text-zinc-500">
                {blob ? `${(blob.size / 1024).toFixed(0)} KB` : ''}
              </p>
            </div>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClear}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
          />

          <div className="flex items-center gap-3">
            <Volume2 className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
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

      {/* Empty state */}
      {!audioUrl && !isRecording && (
        <div className="text-center py-4">
          <p className="text-sm text-zinc-500">Click the microphone to record a voice over</p>
          <p className="text-xs text-zinc-600 mt-1">Your browser will ask for microphone access</p>
        </div>
      )}
    </div>
  )
}
