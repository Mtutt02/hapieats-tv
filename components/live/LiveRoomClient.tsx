'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import MuxPlayer from '@mux/mux-player-react'
import { createClient } from '@/lib/supabase/client'
import { Send, Gift, Lock, StopCircle, Users, Radio, X, ChevronRight } from 'lucide-react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface StreamInfo {
  id: string
  title: string
  description: string | null
  status: string
  mux_playback_id: string | null
  creator: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  }
  channel: { id: string; name: string; slug: string } | null
}

interface SenderProfile {
  username: string
  display_name: string
  avatar_url: string | null
}

interface ChatMessage {
  id: string
  sender_id: string
  message: string
  type: 'message' | 'gift_event' | 'system'
  gift_name?: string | null
  gift_emoji?: string | null
  gift_tokens?: number | null
  is_private: boolean
  recipient_id?: string | null
  created_at: string
  sender?: SenderProfile | null
}

interface LiveGift {
  id: string
  name: string
  emoji: string
  token_cost: number
  display_priority: number
  animation_key: string | null
}

interface CurrentUser {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

interface Props {
  stream: StreamInfo
  currentUser: CurrentUser | null
  isCreator: boolean
  gifts: LiveGift[]
  initialTokenBalance: number
  initialMessages: ChatMessage[]
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function LiveRoomClient({
  stream,
  currentUser,
  isCreator,
  gifts,
  initialTokenBalance,
  initialMessages,
}: Props) {
  const [messages, setMessages]           = useState<ChatMessage[]>(initialMessages)
  const [chatInput, setChatInput]         = useState('')
  const [sendingChat, setSendingChat]     = useState(false)
  const [showGifts, setShowGifts]         = useState(false)
  const [tokenBalance, setTokenBalance]   = useState(initialTokenBalance)
  const [sendingGift, setSendingGift]     = useState<string | null>(null)
  const [streamStatus, setStreamStatus]   = useState(stream.status)
  const [viewerCount, setViewerCount]     = useState(stream.status === 'active' ? 1 : 0)
  const [giftToast, setGiftToast]         = useState<string | null>(null)
  const [pmTarget, setPmTarget]           = useState<{ id: string; name: string } | null>(null)
  const [pmInput, setPmInput]             = useState('')
  const [endingStream, setEndingStream]   = useState(false)

  // Profile cache so Realtime INSERT payloads (which have no joined data) can be displayed
  const profileCacheRef = useRef<Record<string, SenderProfile>>({})

  const chatEndRef = useRef<HTMLDivElement>(null)
  const supabase   = createClient()

  // Seed profile cache from server-fetched initial messages
  useEffect(() => {
    initialMessages.forEach(m => {
      if (m.sender && m.sender_id) {
        profileCacheRef.current[m.sender_id] = m.sender
      }
    })
    // Also cache current user's own profile
    if (currentUser) {
      profileCacheRef.current[currentUser.id] = {
        username:     currentUser.username,
        display_name: currentUser.display_name,
        avatar_url:   currentUser.avatar_url,
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Supabase Realtime: subscribe to new chat messages ──────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`live_chat:${stream.id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'live_chat_messages',
          filter: `stream_id=eq.${stream.id}`,
        },
        async (payload) => {
          const raw = payload.new as ChatMessage

          // Skip private messages we can't see
          if (raw.is_private) {
            if (!currentUser) return
            const weAreSender    = raw.sender_id    === currentUser.id
            const weAreRecipient = raw.recipient_id === currentUser.id
            if (!weAreSender && !weAreRecipient && !isCreator) return
          }

          // Attach sender profile from cache or fetch it
          let sender = profileCacheRef.current[raw.sender_id] ?? null
          if (!sender) {
            try {
              const { data: p } = await supabase
                .from('profiles')
                .select('username, display_name, avatar_url')
                .eq('id', raw.sender_id)
                .single()
              if (p) {
                profileCacheRef.current[raw.sender_id] = p as SenderProfile
                sender = p as SenderProfile
              }
            } catch { /* silent */ }
          }

          setMessages(prev => [...prev, { ...raw, sender }])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [stream.id, currentUser?.id, isCreator]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll stream status + viewer count every 10s ────────────────────────────
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/livestreams/status?id=${stream.id}`)
        if (res.ok) {
          const data = await res.json()
          setStreamStatus(data.status ?? streamStatus)
          if (typeof data.viewer_count === 'number') setViewerCount(data.viewer_count)
        }
      } catch { /* silent */ }
    }, 10_000)
    return () => clearInterval(poll)
  }, [stream.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send public chat message ───────────────────────────────────────────────
  const sendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const text = chatInput.trim().slice(0, 300)
    if (!text || !currentUser || sendingChat) return
    setChatInput('')
    setSendingChat(true)
    try {
      await fetch('/api/live/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stream_id: stream.id, message: text }),
      })
    } finally {
      setSendingChat(false)
    }
  }, [chatInput, currentUser, sendingChat, stream.id])

  // ── Send private message ───────────────────────────────────────────────────
  const sendPrivateMessage = useCallback(async () => {
    const text = pmInput.trim().slice(0, 300)
    if (!text || !currentUser || !pmTarget) return
    setPmInput('')
    await fetch('/api/live/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        stream_id:    stream.id,
        message:      text,
        is_private:   true,
        recipient_id: pmTarget.id,
      }),
    })
    setPmTarget(null)
  }, [pmInput, currentUser, pmTarget, stream.id])

  // ── Send gift ──────────────────────────────────────────────────────────────
  const sendGift = useCallback(async (gift: LiveGift) => {
    if (!currentUser || sendingGift) return
    if (tokenBalance < gift.token_cost) {
      alert(`You need ${gift.token_cost} tokens but only have ${tokenBalance}. Head to /tokens to buy more!`)
      return
    }
    setSendingGift(gift.id)
    try {
      const res = await fetch('/api/live/gift', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stream_id: stream.id, gift_id: gift.id }),
      })
      if (res.ok) {
        const data = await res.json()
        setTokenBalance(data.remaining_balance ?? tokenBalance - gift.token_cost)
        setGiftToast(`${gift.emoji} ${gift.name} sent!`)
        setTimeout(() => setGiftToast(null), 3000)
        setShowGifts(false)
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to send gift' }))
        if (err.error?.includes('nsufficien')) {
          alert('Not enough tokens. Visit /tokens to buy more.')
        } else {
          alert(err.error ?? 'Failed to send gift. Try again.')
        }
      }
    } finally {
      setSendingGift(null)
    }
  }, [currentUser, sendingGift, tokenBalance, stream.id])

  // ── End stream (creator action) ────────────────────────────────────────────
  const endStream = useCallback(async () => {
    if (!isCreator || endingStream) return
    if (!confirm('End this stream? Viewers will be disconnected.')) return
    setEndingStream(true)
    try {
      await fetch('/api/live/end', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stream_id: stream.id }),
      })
      setStreamStatus('ended')
    } finally {
      setEndingStream(false)
    }
  }, [isCreator, endingStream, stream.id])

  const isLive  = streamStatus === 'active'
  const isEnded = streamStatus === 'ended'

  // ── Avatar helper ──────────────────────────────────────────────────────────
  function Avatar({ profile, size = 6 }: { profile?: SenderProfile | null; size?: number }) {
    const cls = `h-${size} w-${size} rounded-full flex-shrink-0 overflow-hidden bg-zinc-700 flex items-center justify-center`
    if (profile?.avatar_url) {
      return (
        <div className={cls}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        </div>
      )
    }
    const initial = (profile?.display_name ?? profile?.username ?? '?')[0]?.toUpperCase()
    return (
      <div className={cls}>
        <span className="text-xs font-bold text-zinc-300">{initial}</span>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100svh-56px)] bg-zinc-950 lg:overflow-hidden">
      {/* Mobile: stacked (video then chat), natural scroll. Desktop: side-by-side fixed height. */}

      {/* ═══════════════════════════════════════════════
          VIDEO PANEL
          ═══════════════════════════════════════════ */}
      <div className="relative flex-1 bg-black flex flex-col min-h-0">

        {/* Player */}
        <div className="relative flex-1 flex items-center justify-center min-h-0 bg-black">
          {isEnded ? (
            <div className="flex flex-col items-center gap-4 text-zinc-400 p-6 text-center">
              <span className="text-6xl">📡</span>
              <p className="text-lg font-semibold text-white">Stream ended</p>
              <p className="text-sm text-zinc-500">Thanks for watching!</p>
              <Link
                href="/live"
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 transition-colors"
              >
                Browse live streams <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ) : !stream.mux_playback_id ? (
            <div className="flex flex-col items-center gap-3 text-zinc-400">
              <Radio className="h-12 w-12 animate-pulse text-red-500" />
              <p className="font-medium text-white">Stream starting soon…</p>
              <p className="text-sm text-zinc-500">Hang tight, the creator is setting up.</p>
            </div>
          ) : (
            <MuxPlayer
              streamType="live"
              playbackId={stream.mux_playback_id}
              autoPlay
              style={{ width: '100%', height: '100%' }}
              metadata={{
                video_title:    stream.title,
                viewer_user_id: currentUser?.id ?? 'anon',
              }}
            />
          )}

          {/* LIVE badge + viewer count */}
          {isLive && (
            <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
              <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
              {viewerCount > 0 && (
                <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                  <Users className="h-3 w-3" /> {viewerCount.toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* Floating gift toast */}
          {giftToast && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/85 backdrop-blur-sm text-white text-sm font-semibold px-5 py-2 rounded-full shadow-xl animate-bounce pointer-events-none">
              {giftToast}
            </div>
          )}
        </div>

        {/* Stream info bar */}
        <div className="bg-zinc-950 border-t border-zinc-800 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
          <Avatar profile={stream.creator as SenderProfile} size={8} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{stream.title}</p>
            <p className="text-xs text-zinc-400 truncate">
              @{stream.creator.username}
              {stream.channel && <span> · {stream.channel.name}</span>}
            </p>
          </div>
          {isCreator && !isEnded && (
            <button
              onClick={endStream}
              disabled={endingStream}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-800/60 hover:border-red-600 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
            >
              <StopCircle className="h-3.5 w-3.5" />
              {endingStream ? 'Ending…' : 'End Stream'}
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          CHAT PANEL
          ═══════════════════════════════════════════ */}
      {/* On mobile the chat panel sits below the video and grows naturally.
          pb-20 leaves room for the mobile bottom nav bar. */}
      <div className="w-full lg:w-80 xl:w-96 flex flex-col border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-950 flex-shrink-0 min-h-0 pb-20 lg:pb-0">

        {/* Chat header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 flex-shrink-0">
          <span className="text-sm font-semibold text-white">Live Chat</span>
          {currentUser && (
            <span className="text-xs text-zinc-400 tabular-nums">
              {tokenBalance.toLocaleString()} 🪙
            </span>
          )}
        </div>

        {/* Messages list */}
        <div
          className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-[220px] lg:min-h-0"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}
        >
          {messages.length === 0 && (
            <p className="text-center text-xs text-zinc-600 py-8 select-none">
              Be the first to say something!
            </p>
          )}

          {messages.map(msg => {
            const isOwnMsg    = currentUser?.id === msg.sender_id
            const isCreatorMsg = msg.sender_id === stream.creator.id
            const senderName  = msg.sender?.display_name ?? msg.sender?.username ?? 'User'

            return (
              <div
                key={msg.id}
                className={[
                  'group flex gap-1.5 items-start text-[13px] py-0.5 rounded px-1.5 transition-colors',
                  msg.is_private
                    ? 'bg-blue-950/30 border border-blue-800/30 rounded-lg'
                    : 'hover:bg-white/5',
                ].join(' ')}
              >
                {/* Sender avatar */}
                <Avatar profile={msg.sender} size={5} />

                {/* Message content */}
                <div className="flex-1 min-w-0 leading-snug">
                  {msg.type === 'gift_event' ? (
                    <span>
                      <span className="font-semibold text-yellow-400">{senderName}</span>
                      <span className="text-zinc-400"> sent </span>
                      <span className="font-bold text-yellow-300">
                        {msg.gift_emoji} {msg.gift_name}
                      </span>
                      {msg.gift_tokens && (
                        <span className="text-zinc-500 text-xs ml-1">({msg.gift_tokens}🪙)</span>
                      )}
                    </span>
                  ) : msg.type === 'system' ? (
                    <span className="italic text-zinc-500">{msg.message}</span>
                  ) : (
                    <span>
                      <span
                        className={[
                          'font-semibold mr-1',
                          isCreatorMsg ? 'text-orange-400' : isOwnMsg ? 'text-blue-400' : 'text-zinc-200',
                        ].join(' ')}
                      >
                        {senderName}
                        {isCreatorMsg && (
                          <span className="ml-1 text-[10px] bg-orange-500/20 text-orange-400 px-1 py-0.5 rounded font-bold align-middle">
                            creator
                          </span>
                        )}
                        {msg.is_private && (
                          <span className="ml-1 text-[10px] text-blue-400 align-middle">🔒</span>
                        )}
                      </span>
                      <span className="text-zinc-300 break-words">{msg.message}</span>
                    </span>
                  )}
                </div>

                {/* DM button (visible on hover, only for other users while stream is live) */}
                {currentUser &&
                  !isOwnMsg &&
                  isLive &&
                  !msg.is_private &&
                  msg.type === 'message' && (
                    <button
                      onClick={() => setPmTarget({ id: msg.sender_id, name: senderName })}
                      title={`Send ${senderName} a private message`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-zinc-600 hover:text-blue-400 p-0.5 mt-0.5"
                    >
                      <Lock className="h-3 w-3" />
                    </button>
                  )}
              </div>
            )
          })}

          <div ref={chatEndRef} />
        </div>

        {/* Private message compose */}
        {pmTarget && currentUser && (
          <div className="mx-3 mb-2 p-3 bg-blue-950/30 border border-blue-800/40 rounded-xl flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-blue-400 flex items-center gap-1">
                <Lock className="h-3 w-3" /> Private to {pmTarget.name}
              </span>
              <button
                onClick={() => setPmTarget(null)}
                className="text-zinc-500 hover:text-white p-0.5 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={pmInput}
                onChange={e => setPmInput(e.target.value.slice(0, 300))}
                placeholder="Write a private message…"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 min-w-0"
                onKeyDown={e => { if (e.key === 'Enter') sendPrivateMessage() }}
                autoFocus
              />
              <button
                onClick={sendPrivateMessage}
                disabled={!pmInput.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* Gift picker panel */}
        {showGifts && currentUser && (
          <div className="border-t border-zinc-800 px-3 py-3 bg-zinc-900/60 flex-shrink-0">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-zinc-200">Send a Gift</span>
              <button
                onClick={() => setShowGifts(false)}
                className="text-zinc-500 hover:text-white p-0.5 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {gifts.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-2">No gifts available.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {gifts.map(gift => {
                  const canAfford = tokenBalance >= gift.token_cost
                  return (
                    <button
                      key={gift.id}
                      onClick={() => sendGift(gift)}
                      disabled={!!sendingGift || !canAfford}
                      className={[
                        'flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-center',
                        canAfford && !sendingGift
                          ? 'border-zinc-700 hover:border-orange-500/60 hover:bg-orange-500/5 cursor-pointer active:scale-95'
                          : 'border-zinc-800/60 opacity-40 cursor-not-allowed',
                        sendingGift === gift.id ? 'animate-pulse' : '',
                      ].join(' ')}
                    >
                      <span className="text-xl leading-none">{gift.emoji}</span>
                      <span className="text-[10px] font-medium text-zinc-300 leading-tight truncate w-full text-center">
                        {gift.name}
                      </span>
                      <span className="text-[10px] font-bold text-orange-400">
                        {gift.token_cost}🪙
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            <Link
              href="/tokens"
              className="block text-center text-xs text-zinc-500 hover:text-orange-400 mt-2.5 transition-colors"
            >
              Buy more tokens →
            </Link>
          </div>
        )}

        {/* Chat input bar */}
        <div className="border-t border-zinc-800 flex-shrink-0">
          {isEnded ? (
            <div className="px-4 py-3 text-center text-xs text-zinc-500">
              Stream ended
            </div>
          ) : !currentUser ? (
            <div className="px-4 py-3 text-center">
              <Link
                href="/login"
                className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
              >
                Sign in to chat
              </Link>
            </div>
          ) : (
            <form onSubmit={sendMessage} className="flex items-center gap-2 px-3 py-2.5">
              {/* Gift toggle */}
              <button
                type="button"
                onClick={() => setShowGifts(v => !v)}
                title="Send a gift"
                className={[
                  'flex-shrink-0 p-2 rounded-lg transition-colors',
                  showGifts
                    ? 'text-orange-400 bg-orange-500/15'
                    : 'text-zinc-500 hover:text-orange-400 hover:bg-orange-500/10',
                ].join(' ')}
              >
                <Gift className="h-4 w-4" />
              </button>

              {/* Text input */}
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value.slice(0, 300))}
                placeholder="Say something…"
                maxLength={300}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/60 min-w-0"
              />

              {/* Send */}
              <button
                type="submit"
                disabled={!chatInput.trim() || sendingChat}
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
