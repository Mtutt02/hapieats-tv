'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Radio, Video, VideoOff, Mic, MicOff, Copy, Check, ExternalLink, StopCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface GoLiveStudioProps {
  channels: Array<{ id: string; name: string; slug: string }>
}

type Phase = 'setup' | 'preview' | 'live' | 'ended'
type WhipStatus = 'idle' | 'connecting' | 'connected' | 'error'

async function startWhipStream(streamKey: string, stream: MediaStream): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
  })

  stream.getTracks().forEach(track => pc.addTrack(track, stream))

  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)

  await new Promise<void>(resolve => {
    if (pc.iceGatheringState === 'complete') { resolve(); return }
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') resolve()
    }
    setTimeout(resolve, 3000)
  })

  const whipUrl = `https://global-live.mux.com/api/v1/whip/${streamKey}`
  const response = await fetch(whipUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: pc.localDescription!.sdp,
  })

  if (!response.ok) throw new Error('WHIP connection failed')

  const answerSdp = await response.text()
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

  return pc
}

export default function GoLiveStudio({ channels }: GoLiveStudioProps) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [whipStatus, setWhipStatus] = useState<WhipStatus>('idle')
  const [streamId, setStreamId] = useState<string | null>(null)
  const [streamKey, setStreamKey] = useState<string | null>(null)
  const [streamStatus, setStreamStatus] = useState<string>('idle')
  const [copied, setCopied] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop())
      }
      if (pcRef.current) {
        pcRef.current.close()
      }
    }
  }, [])

  const startPreview = useCallback(async () => {
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      mediaStreamRef.current = stream
      setPhase('preview')
      // Attach to video element after render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      }, 50)
    } catch (err) {
      setError('Could not access camera or microphone. Please grant permission and try again.')
    } finally {
      setLoading(false)
    }
  }, [title])

  const goLive = useCallback(async () => {
    if (!mediaStreamRef.current) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/livestreams/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          channelId,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create stream')

      const { stream_key, id } = json
      setStreamId(id)
      setStreamKey(stream_key)
      setPhase('live')
      setWhipStatus('connecting')

      const pc = await startWhipStream(stream_key, mediaStreamRef.current)
      pcRef.current = pc
      setWhipStatus('connected')

      // Start polling for status
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/livestreams/status?id=${id}`)
          if (statusRes.ok) {
            const data = await statusRes.json()
            setStreamStatus(data.status ?? 'idle')
          }
        } catch {
          // ignore poll errors
        }
      }, 5000)
    } catch (err) {
      setWhipStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to start stream. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [title, description, channelId])

  const endStream = useCallback(async () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
    }
    if (pcRef.current) {
      pcRef.current.close()
    }
    setPhase('ended')
    // Update DB immediately so viewers see "stream ended" right away.
    // The Mux webhook also fires video.live_stream.idle and updates the DB,
    // but this ensures near-instant feedback for viewers already in the room.
    if (streamId) {
      fetch('/api/live/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream_id: streamId }),
      }).catch(() => { /* non-fatal */ })
    }
  }, [streamId])

  const backToSetup = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
    setError(null)
    setPhase('setup')
  }, [])

  const copyWatchLink = useCallback(async () => {
    if (!streamId) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/live/${streamId}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }, [streamId])

  // --- Phase: Setup ---
  if (phase === 'setup') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="w-full max-w-lg border-zinc-800 bg-zinc-950 text-white shadow-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 mb-1">
              <Radio className="h-5 w-5 text-red-500" />
              <CardTitle className="text-xl font-bold tracking-tight">Go Live</CardTitle>
            </div>
            <p className="text-sm text-zinc-400">Stream directly from your browser — no software needed.</p>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            {channels.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-200">Channel</label>
                <Select value={channelId} onValueChange={setChannelId}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white focus:ring-red-500">
                    <SelectValue placeholder="Select a channel" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                    {channels.map(ch => (
                      <SelectItem key={ch.id} value={ch.id} className="focus:bg-zinc-800">
                        {ch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-200">
                Title <span className="text-red-400">*</span>
              </label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Title"
                className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-red-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-200">Description</label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Tell viewers what to expect..."
                rows={3}
                className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-red-500 resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button
              onClick={startPreview}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold h-11"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Requesting camera...</>
              ) : (
                <><Video className="mr-2 h-4 w-4" /> Start Preview</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- Phase: Preview ---
  if (phase === 'preview') {
    const selectedChannel = channels.find(c => c.id === channelId)
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 gap-6">
        <div className="w-full max-w-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{title}</h2>
              {selectedChannel && (
                <p className="text-sm text-zinc-400 mt-0.5">{selectedChannel.name}</p>
              )}
            </div>
            <Badge variant="outline" className="border-yellow-500 text-yellow-400 bg-yellow-950/30 text-xs font-semibold px-3 py-1">
              PREVIEW
            </Badge>
          </div>

          {/* Camera preview */}
          <div className="relative w-full aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1 text-xs text-white backdrop-blur-sm">
                <Video className="h-3 w-3 text-green-400" /> Camera on
              </span>
              <span className="flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1 text-xs text-white backdrop-blur-sm">
                <Mic className="h-3 w-3 text-green-400" /> Mic on
              </span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={backToSetup}
              disabled={loading}
              className="flex-1 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Back to Setup
            </Button>
            <Button
              onClick={goLive}
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold h-11"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...</>
              ) : (
                <><Radio className="mr-2 h-4 w-4" /> Go Live</>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // --- Phase: Live ---
  if (phase === 'live') {
    const watchLink = streamId ? `/live/${streamId}` : null
    const isConnecting = whipStatus === 'connecting'
    const isConnected = whipStatus === 'connected'
    const hasError = whipStatus === 'error'

    return (
      <div className="flex flex-col min-h-[calc(100svh-56px)] bg-zinc-950">
        {/* Full-width camera feed */}
        <div className="relative flex-1 bg-black overflow-hidden" style={{ minHeight: '60vh' }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Dark scrim at top */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

          {/* Title + status bar — top left */}
          <div className="absolute top-4 left-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              {/* LIVE badge */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white shadow-lg">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" /> LIVE
              </span>
              {/* Connection status */}
              {isConnecting && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 px-3 py-1 text-xs font-semibold text-yellow-300 backdrop-blur-sm">
                  <Loader2 className="h-3 w-3 animate-spin" /> Connecting to Mux…
                </span>
              )}
              {isConnected && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 border border-green-500/40 px-3 py-1 text-xs font-semibold text-green-300 backdrop-blur-sm">
                  ✓ Stream connected
                </span>
              )}
              {hasError && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-500/40 px-3 py-1 text-xs font-semibold text-red-300 backdrop-blur-sm">
                  Connection error
                </span>
              )}
            </div>
            <h2 className="text-white font-bold text-lg drop-shadow-lg">{title}</h2>
          </div>

          {/* Connecting overlay — pulsing vignette when still connecting */}
          {isConnecting && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-8 py-5 flex flex-col items-center gap-3 border border-white/10">
                  <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
                  <p className="text-white font-semibold text-base">Connecting your stream…</p>
                  <p className="text-zinc-400 text-xs text-center max-w-xs">
                    Establishing WebRTC connection to Mux. This takes a few seconds.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* "Viewers can watch" badge — bottom left once active */}
          {streamStatus === 'active' && (
            <div className="absolute bottom-4 left-4">
              <span className="flex items-center gap-1.5 bg-red-600 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" /> Viewers can watch!
              </span>
            </div>
          )}

          {/* Dark scrim at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
        </div>

        {/* Controls strip */}
        <div className="bg-zinc-950 border-t border-zinc-800 px-4 py-4 space-y-3 flex-shrink-0">
          {/* Watch link */}
          {watchLink && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5">
                <span className="text-xs text-zinc-400 flex-1 truncate font-mono">
                  {typeof window !== 'undefined' ? window.location.origin : ''}{watchLink}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyWatchLink}
                  className="shrink-0 text-zinc-300 hover:text-white h-7 px-2"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Link href={watchLink} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="shrink-0 text-zinc-300 hover:text-white h-7 px-2">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
              <Link href={watchLink} target="_blank" rel="noopener noreferrer" className="block">
                <Button
                  variant="outline"
                  className="w-full border-orange-700/60 text-orange-400 hover:bg-orange-950/40 hover:text-orange-300 font-semibold h-10"
                >
                  <ExternalLink className="mr-2 h-4 w-4" /> Join Live Room
                </Button>
              </Link>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button
            onClick={endStream}
            variant="outline"
            className="w-full border-red-800 text-red-400 hover:bg-red-950/40 hover:text-red-300 font-semibold h-10"
          >
            <StopCircle className="mr-2 h-4 w-4" /> End Stream
          </Button>
        </div>
      </div>
    )
  }

  // --- Phase: Ended ---
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-950 text-white shadow-2xl text-center">
        <CardContent className="pt-10 pb-8 space-y-4">
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-4 py-1.5 text-sm font-medium text-zinc-400">
              Stream ended
            </span>
          </div>
          <p className="text-zinc-400 text-sm">Your stream has ended. Thanks for going live!</p>
          {streamId && (
            <Link
              href={`/live/${streamId}`}
              className="text-sm text-red-400 hover:text-red-300 underline underline-offset-4"
            >
              View stream page
            </Link>
          )}
          <Button
            onClick={() => {
              setPhase('setup')
              setTitle('')
              setDescription('')
              setChannelId(channels[0]?.id ?? '')
              setStreamId(null)
              setStreamKey(null)
              setError(null)
              setWhipStatus('idle')
              setStreamStatus('idle')
            }}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white mt-2"
          >
            Go back to studio
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
