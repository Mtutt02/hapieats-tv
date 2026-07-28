'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import MuxPlayer from '@mux/mux-player-react'
import { createClient } from '@/lib/supabase/client'
import {
  Send, Users, Radio, Hand, Mic, MicOff, StopCircle, PlayCircle, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CohortInfo {
  id: string
  courseId: string
  title: string
  startsAt: string
  endsAt: string | null
  status: string
}
interface CourseInfo { id: string; title: string; level: string }
interface CurrentUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

interface Props {
  cohort: CohortInfo
  course: CourseInfo
  playbackId: string | null
  streamStatus: string | null
  isInstructor: boolean
  memberCount: number
  currentUser: CurrentUser
}

// A chat message travels over the Realtime *broadcast* channel (no DB table needed).
interface ChatMsg {
  id: string
  senderId: string
  senderName: string
  text: string
  at: number
}

// One entry per connected participant, tracked via Realtime *presence*.
interface Participant {
  userId: string
  name: string
  handRaised: boolean
  talking: boolean
  isInstructor: boolean
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function Classroom({
  cohort,
  course,
  playbackId,
  streamStatus,
  isInstructor,
  memberCount,
  currentUser,
}: Props) {
  const [status, setStatus] = useState(cohort.status)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [handRaised, setHandRaised] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [micError, setMicError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Web Audio plumbing for the local mic level meter.
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  // Latest presence values, read inside callbacks without re-subscribing.
  const handRef = useRef(false)
  const talkingRef = useRef(false)

  // Auto-scroll chat.
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Push our current presence state onto the shared channel.
  const syncPresence = useCallback(() => {
    channelRef.current?.track({
      userId: currentUser.id,
      name: currentUser.displayName,
      handRaised: handRef.current,
      talking: talkingRef.current,
      isInstructor,
    })
  }, [currentUser.id, currentUser.displayName, isInstructor])

  // ── Realtime: presence (participants) + broadcast (chat, raise-hand, status) ──
  useEffect(() => {
    const channel = supabase.channel(`cohort_chat:${cohort.id}`, {
      config: { presence: { key: currentUser.id } },
    })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<Participant & Record<string, unknown>>()
        const list: Participant[] = []
        for (const key of Object.keys(state)) {
          const meta = state[key][0] as unknown as Participant
          if (meta?.userId) {
            list.push({
              userId: meta.userId,
              name: meta.name ?? 'Chef',
              handRaised: !!meta.handRaised,
              talking: !!meta.talking,
              isInstructor: !!meta.isInstructor,
            })
          }
        }
        list.sort((a, b) => Number(b.isInstructor) - Number(a.isInstructor))
        setParticipants(list)
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setMessages(prev => [...prev, payload as ChatMsg])
      })
      .on('broadcast', { event: 'status' }, ({ payload }) => {
        if (payload?.status) setStatus(payload.status as string)
      })
      .subscribe(async (s) => {
        if (s === 'SUBSCRIBED') syncPresence()
      })

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [cohort.id, currentUser.id, supabase, syncPresence])

  // ── Send a chat message (broadcast — mirrors LiveRoomClient's send flow) ─────
  const sendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const text = chatInput.trim().slice(0, 300)
    if (!text || !channelRef.current) return
    const msg: ChatMsg = {
      id: `${currentUser.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      text,
      at: Date.now(),
    }
    setChatInput('')
    // Optimistic local echo (broadcast doesn't self-deliver by default).
    setMessages(prev => [...prev, msg])
    channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg })
  }, [chatInput, currentUser.id, currentUser.displayName])

  // ── Raise / lower hand — updates presence AND broadcasts a chat notice ───────
  const toggleHand = useCallback(() => {
    const next = !handRaised
    setHandRaised(next)
    handRef.current = next
    syncPresence()
    channelRef.current?.send({
      type: 'broadcast',
      event: 'chat',
      payload: {
        id: `sys-${Date.now()}`,
        senderId: 'system',
        senderName: 'system',
        text: `✋ ${currentUser.displayName} ${next ? 'raised' : 'lowered'} their hand`,
        at: Date.now(),
      } as ChatMsg,
    })
  }, [handRaised, currentUser.displayName, syncPresence])

  // ── Mic capture: local getUserMedia + a level meter. NOT an SFU. ─────────────
  const stopMic = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    analyserRef.current = null
    setMicLevel(0)
    talkingRef.current = false
    setMicOn(false)
    syncPresence()
  }, [syncPresence])

  const startMic = useCallback(async () => {
    setMicError(null)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicError('Your browser does not support microphone capture.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new Ctx()
      audioCtxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      analyserRef.current = analyser
      const buf = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        analyser.getByteFrequencyData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) sum += buf[i]
        const level = Math.min(1, sum / buf.length / 128)
        setMicLevel(level)
        const talking = level > 0.12
        if (talking !== talkingRef.current) {
          talkingRef.current = talking
          syncPresence()
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
      setMicOn(true)
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') setMicError('Microphone permission was denied.')
      else if (err?.name === 'NotFoundError') setMicError('No microphone was found.')
      else setMicError('Could not access your microphone.')
      setMicOn(false)
    }
  }, [syncPresence])

  const toggleMic = useCallback(() => { if (micOn) { stopMic() } else { void startMic() } }, [micOn, startMic, stopMic])

  // Tidy up mic + audio graph on unmount.
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close().catch(() => {})
  }, [])

  // ── Instructor: advance status (scheduled → live → ended) ────────────────────
  const setCohortStatus = useCallback(async (next: 'live' | 'ended') => {
    if (!isInstructor || updatingStatus) return
    if (next === 'ended' && !confirm('End this class for everyone?')) return
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/academy/cohorts/${cohort.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (res.ok) {
        setStatus(next)
        channelRef.current?.send({ type: 'broadcast', event: 'status', payload: { status: next } })
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Could not update the class status.')
      }
    } finally {
      setUpdatingStatus(false)
    }
  }, [isInstructor, updatingStatus, cohort.id])

  const isLive = status === 'live'
  const isEnded = status === 'ended'
  const handsUp = participants.filter(p => p.handRaised)

  // ── Avatar helper ────────────────────────────────────────────────────────────
  function initialFor(name: string) { return (name?.[0] ?? '?').toUpperCase() }

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100svh-56px)] bg-zinc-950 lg:overflow-hidden">
      {/* MAIN: video + audio controls */}
      <div className="relative flex-1 bg-black flex flex-col min-h-0">
        {/* Video */}
        <div className="relative flex-1 flex items-center justify-center min-h-0 bg-black">
          {isEnded ? (
            <div className="flex flex-col items-center gap-4 text-zinc-400 p-6 text-center">
              <span className="text-6xl">🍳</span>
              <p className="text-lg font-semibold text-white">Class ended</p>
              <p className="text-sm text-zinc-500">Thanks for cooking along!</p>
              <Link
                href={`/academy/courses/${cohort.courseId}`}
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 transition-colors"
              >
                Back to course <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ) : !playbackId ? (
            <div className="flex flex-col items-center gap-3 text-zinc-400 p-6 text-center">
              <Radio className="h-12 w-12 animate-pulse text-orange-500" />
              <p className="font-medium text-white">
                {isInstructor ? 'Your class is ready' : 'Class starting soon…'}
              </p>
              <p className="text-sm text-zinc-500 max-w-xs">
                {isInstructor
                  ? 'Start streaming from your broadcast software to your cohort stream key, then hit Go Live.'
                  : 'Hang tight — the instructor is setting up the cook-along.'}
              </p>
            </div>
          ) : (
            <MuxPlayer
              streamType="live"
              playbackId={playbackId}
              autoPlay
              style={{ width: '100%', height: '100%' }}
              metadata={{ video_title: cohort.title, viewer_user_id: currentUser.id }}
            />
          )}

          {isLive && (
            <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
              <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
              <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                <Users className="h-3 w-3" /> {participants.length || memberCount}
              </span>
            </div>
          )}
        </div>

        {/* Info + instructor controls */}
        <div className="bg-zinc-950 border-t border-zinc-800 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{cohort.title}</p>
            <p className="text-xs text-zinc-400 truncate">
              {course.title} · {course.level}
              {' · '}
              {new Date(cohort.startsAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          {isInstructor && !isEnded && (
            !isLive ? (
              <button
                onClick={() => setCohortStatus('live')}
                disabled={updatingStatus}
                className="flex items-center gap-1.5 text-xs text-white bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                {updatingStatus ? 'Starting…' : 'Go Live'}
              </button>
            ) : (
              <button
                onClick={() => setCohortStatus('ended')}
                disabled={updatingStatus}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-800/60 hover:border-red-600 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
              >
                <StopCircle className="h-3.5 w-3.5" />
                {updatingStatus ? 'Ending…' : 'End Class'}
              </button>
            )
          )}
        </div>

        {/* AUDIO layer — local mic capture + level meter + raise hand (honest: not an SFU) */}
        <div className="bg-zinc-900/70 border-t border-zinc-800 px-4 py-3 flex flex-col gap-2 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMic}
              className={[
                'flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors flex-shrink-0',
                micOn
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200',
              ].join(' ')}
            >
              {micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
              {micOn ? 'Mic on' : 'Enable mic'}
            </button>

            {/* Live level meter — reflects your captured mic input */}
            <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-orange-400 transition-[width] duration-75"
                style={{ width: `${Math.round(micLevel * 100)}%` }}
              />
            </div>

            <button
              onClick={toggleHand}
              className={[
                'flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors flex-shrink-0',
                handRaised
                  ? 'bg-amber-500 hover:bg-amber-400 text-black'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200',
              ].join(' ')}
            >
              <Hand className="h-3.5 w-3.5" />
              {handRaised ? 'Hand up' : 'Raise hand'}
            </button>
          </div>

          {micError && <p className="text-[11px] text-red-400">{micError}</p>}
          <p className="text-[11px] text-zinc-500 leading-snug">
            Voice here is presence-based: your mic is captured locally (level shown above) and your
            talking/hand-raise state is broadcast to the room. Full two-way audio mixing is not part of
            this room.
          </p>
        </div>
      </div>

      {/* SIDE: participants + chat */}
      <div className="w-full lg:w-80 xl:w-96 flex flex-col border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-950 flex-shrink-0 min-h-0 pb-20 lg:pb-0">
        {/* Participants */}
        <div className="border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Users className="h-4 w-4 text-zinc-400" /> Participants
            </span>
            <span className="text-xs text-zinc-400 tabular-nums">{participants.length}</span>
          </div>
          {handsUp.length > 0 && (
            <div className="px-4 pb-2 text-[11px] text-amber-400">
              ✋ {handsUp.map(p => p.name).join(', ')}
            </div>
          )}
          <div className="max-h-32 overflow-y-auto px-3 pb-2 space-y-0.5">
            {participants.length === 0 && (
              <p className="text-center text-xs text-zinc-600 py-2 select-none">Waiting for others…</p>
            )}
            {participants.map(p => (
              <div key={p.userId} className="flex items-center gap-2 text-[13px] px-1.5 py-1 rounded hover:bg-white/5">
                <span className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300 flex-shrink-0">
                  {initialFor(p.name)}
                </span>
                <span className="flex-1 min-w-0 truncate text-zinc-200">
                  {p.name}
                  {p.userId === currentUser.id && <span className="text-zinc-500"> (you)</span>}
                </span>
                {p.isInstructor && (
                  <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1 py-0.5 rounded font-bold">host</span>
                )}
                {p.talking && <Mic className="h-3 w-3 text-emerald-400 flex-shrink-0 animate-pulse" />}
                {p.handRaised && <Hand className="h-3 w-3 text-amber-400 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Chat header */}
        <div className="flex items-center px-4 py-2.5 border-b border-zinc-800 flex-shrink-0">
          <span className="text-sm font-semibold text-white">Class Chat</span>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-[180px] lg:min-h-0"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}
        >
          {messages.length === 0 && (
            <p className="text-center text-xs text-zinc-600 py-8 select-none">Say hi to the class!</p>
          )}
          {messages.map(msg => {
            const isOwn = msg.senderId === currentUser.id
            const isSystem = msg.senderId === 'system'
            return (
              <div key={msg.id} className="flex gap-1.5 items-start text-[13px] py-0.5 px-1.5 rounded hover:bg-white/5">
                {isSystem ? (
                  <span className="italic text-zinc-500">{msg.text}</span>
                ) : (
                  <span className="leading-snug">
                    <span className={['font-semibold mr-1', isOwn ? 'text-blue-400' : 'text-zinc-200'].join(' ')}>
                      {msg.senderName}
                    </span>
                    <span className="text-zinc-300 break-words">{msg.text}</span>
                  </span>
                )}
              </div>
            )
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div className="border-t border-zinc-800 flex-shrink-0">
          {isEnded ? (
            <div className="px-4 py-3 text-center text-xs text-zinc-500">Class ended</div>
          ) : (
            <form onSubmit={sendMessage} className="flex items-center gap-2 px-3 py-2.5">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value.slice(0, 300))}
                placeholder="Say something…"
                maxLength={300}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/60 min-w-0"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="flex-shrink-0 p-2 text-orange-400 hover:text-orange-300 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
