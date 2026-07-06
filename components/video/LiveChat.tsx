'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Gift, Zap, Smile, X } from 'lucide-react'

interface LiveChatProps {
  streamId: string
  userId: string | null
  displayName: string | null
  creatorId?: string | null
}

interface ChatMessage {
  id: string
  userId: string | null
  displayName: string | null
  text: string
  timestamp: number
  isGift?: boolean
  giftEmoji?: string
  giftName?: string
  giftCost?: number
}

interface FloatingReaction {
  id: string
  emoji: string
  x: number // percentage 10–90
}

// Must match /api/flavor/gift GIFTS catalog exactly
const GIFT_CATALOG = [
  { id: 'sauce_drop',    name: 'Sauce Drop',    emoji: '🫙',  cost: 5    },
  { id: 'chopsticks',    name: 'Chopsticks',    emoji: '🥢',  cost: 10   },
  { id: 'taco_pop',      name: 'Taco Pop',      emoji: '🌮',  cost: 25   },
  { id: 'ramen_bowl',    name: 'Ramen Bowl',    emoji: '🍜',  cost: 50   },
  { id: 'hapi_plate',    name: 'Hapi Plate',    emoji: '🍽️',  cost: 100  },
  { id: 'bento_box',     name: 'Bento Box',     emoji: '🍱',  cost: 250  },
  { id: 'hibachi_flame', name: 'Hibachi Flame', emoji: '🔥',  cost: 500  },
  { id: 'chef_hat',      name: 'Chef Hat',      emoji: '👨‍🍳', cost: 1000 },
]

// One-tap reaction emojis shown above the input
const QUICK_REACTIONS = ['❤️', '🔥', '😂', '👏', '🤤']

// Emoji picker — 3 categories
const EMOJI_CATEGORIES = [
  {
    label: '😄',
    emojis: [
      '😀','😂','🥹','😍','🤩','🫡','🤤','😋','🙌','👏',
      '❤️','🔥','💯','✨','👍','💪','🎉','🤯','😱','🫶',
      '😊','🥰','🤗','😎','🤌','👌','🙏','💀','😭','🥳',
    ],
  },
  {
    label: '🍕',
    emojis: [
      '🍕','🍔','🌮','🍜','🍣','🥗','🍱','🍰','🍩','🧇',
      '🥘','🍛','🌯','🫕','🥙','🧆','🍝','🍲','🥩','🧀',
      '🌶️','🥑','🍳','🍷','🧃','🥐','🫔','🍤','🦐','🥟',
    ],
  },
  {
    label: '👨‍🍳',
    emojis: [
      '👨‍🍳','🍽️','🫙','🥢','🔪','🧂','🥄','🍴','🏆','⭐',
      '🌟','💫','🎊','🎯','💥','🔔','📣','🎤','🎬','📷',
      '🏅','🎖️','🥇','✅','💎','🫀','🧠','👀','💸','🎁',
    ],
  },
]

function timeAgo(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 1000)
  if (d < 60) return `${d}s ago`
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  return `${Math.floor(d / 3600)}h ago`
}

function formatCost(n: number) {
  return n >= 1000 ? `${n / 1000}k` : String(n)
}

export default function LiveChat({ streamId, userId, displayName, creatorId }: LiveChatProps) {
  const [messages, setMessages]                   = useState<ChatMessage[]>([])
  const [text, setText]                           = useState('')
  const [onlineCount, setOnlineCount]             = useState(0)
  const [showGifts, setShowGifts]                 = useState(false)
  const [showEmojiPicker, setShowEmojiPicker]     = useState(false)
  const [emojiTab, setEmojiTab]                   = useState(0)
  const [flavorBalance, setFlavorBalance]         = useState<number | null>(null)
  const [sendingGift, setSendingGift]             = useState<string | null>(null)
  const [giftAnim, setGiftAnim]                   = useState<ChatMessage | null>(null)
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([])

  const channelRef = useRef<RealtimeChannel | null>(null)
  const bottomRef  = useRef<HTMLDivElement | null>(null)
  const inputRef   = useRef<HTMLInputElement | null>(null)
  const supabase   = createClient()

  // Fetch Flavor Points balance
  useEffect(() => {
    if (!userId) return
    fetch('/api/flavor/wallet')
      .then(r => r.json())
      .then(d => setFlavorBalance(d.balance ?? 0))
      .catch(() => setFlavorBalance(0))
  }, [userId])

  // Supabase realtime channel — messages + reactions + presence
  useEffect(() => {
    const channel = supabase
      .channel(`live-chat:${streamId}`, {
        config: { presence: { key: userId ?? `guest-${Math.random().toString(36).slice(2)}` } },
      })
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        const msg: ChatMessage = {
          id: `${payload.timestamp}-${Math.random()}`,
          userId: payload.userId ?? null,
          displayName: payload.displayName ?? null,
          text: payload.text,
          timestamp: payload.timestamp,
          isGift: payload.isGift ?? false,
          giftEmoji: payload.giftEmoji,
          giftName: payload.giftName,
          giftCost: payload.giftCost,
        }
        setMessages(prev => [...prev.slice(-199), msg])
        if (msg.isGift) {
          setGiftAnim(msg)
          setTimeout(() => setGiftAnim(null), 3000)
        }
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        // Spawn a floating emoji that drifts upward and fades out
        const id = `${Date.now()}-${Math.random()}`
        const x  = 10 + Math.random() * 80
        setFloatingReactions(prev => [...prev.slice(-19), { id, emoji: payload.emoji, x }])
        setTimeout(() => {
          setFloatingReactions(prev => prev.filter(r => r.id !== id))
        }, 2600)
      })
      .on('presence', { event: 'sync' }, () => {
        setOnlineCount(Object.keys(channel.presenceState()).length)
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId, displayName, joinedAt: Date.now() })
        }
      })

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId, userId])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Insert emoji into the text field and keep focus
  const insertEmoji = useCallback((emoji: string) => {
    setText(prev => (prev + emoji).slice(0, 200))
    setShowEmojiPicker(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  // Broadcast a floating reaction to all viewers (no chat message created)
  const sendReaction = useCallback(async (emoji: string) => {
    if (!channelRef.current) return
    await channelRef.current.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { emoji, userId, displayName },
    })
  }, [userId, displayName])

  const sendMessage = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || !channelRef.current || !userId) return
    setText('')
    setShowEmojiPicker(false)
    await channelRef.current.send({
      type: 'broadcast',
      event: 'message',
      payload: {
        userId,
        displayName: displayName ?? 'Guest',
        text: trimmed,
        timestamp: Date.now(),
      },
    })
  }, [text, userId, displayName])

  const sendGift = async (gift: typeof GIFT_CATALOG[0]) => {
    if (!userId || !creatorId) { window.location.href = '/login'; return }
    if ((flavorBalance ?? 0) < gift.cost) { window.location.href = '/flavor'; return }

    setSendingGift(gift.id)
    try {
      const res = await fetch('/api/flavor/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftId: gift.id, streamId, creatorId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFlavorBalance(data.newBalance)
        await channelRef.current?.send({
          type: 'broadcast',
          event: 'message',
          payload: {
            userId,
            displayName: displayName ?? 'Guest',
            text: `sent a ${gift.name}!`,
            timestamp: Date.now(),
            isGift: true,
            giftEmoji: gift.emoji,
            giftName: gift.name,
            giftCost: gift.cost,
          },
        })
      } else {
        fetch('/api/flavor/wallet').then(r => r.json()).then(d => setFlavorBalance(d.balance ?? 0))
      }
    } catch {
      // ignore network errors
    } finally {
      setSendingGift(null)
      setShowGifts(false)
    }
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
      if (e.key === 'Escape') { setShowEmojiPicker(false); setShowGifts(false) }
    },
    [sendMessage],
  )

  return (
    <>
      {/* Floating reaction animation keyframes — self-contained, no global CSS changes */}
      <style>{`
        @keyframes hapiFloatUp {
          0%   { opacity: 1;   transform: translateX(-50%) translateY(0)      scale(1);   }
          50%  { opacity: 0.9; transform: translateX(-50%) translateY(-70px)  scale(1.3); }
          100% { opacity: 0;   transform: translateX(-50%) translateY(-140px) scale(0.7); }
        }
        .hapi-float { animation: hapiFloatUp 2.5s ease-out forwards; }
      `}</style>

      <div className="relative flex flex-col h-full min-h-0 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">

        {/* Gift bounce overlay */}
        {giftAnim && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20 animate-bounce">
            <div className="text-center">
              <div className="text-7xl">{giftAnim.giftEmoji}</div>
              <p className="text-white font-bold text-sm mt-1">
                {giftAnim.displayName} sent {giftAnim.giftName}!
              </p>
            </div>
          </div>
        )}

        {/* Floating emoji reactions */}
        {floatingReactions.map(r => (
          <div
            key={r.id}
            className="hapi-float absolute bottom-24 pointer-events-none z-30 text-3xl select-none"
            style={{ left: `${r.x}%` }}
          >
            {r.emoji}
          </div>
        ))}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <span className="font-semibold text-sm text-white">Chat</span>
          <div className="flex items-center gap-2">
            {userId && flavorBalance !== null && (
              <a
                href="/flavor"
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition"
                title="Flavor Points balance"
              >
                <Zap className="h-3.5 w-3.5" />
                {flavorBalance.toLocaleString()} pts
              </a>
            )}
            {onlineCount > 0 && (
              <span className="text-xs text-zinc-500">{onlineCount} watching</span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.length === 0 && (
            <p className="text-xs text-zinc-500 text-center pt-4">
              No messages yet. Be the first to say hi! 👋
            </p>
          )}
          {messages.map(msg => (
            <div key={msg.id} className="group">
              {msg.isGift ? (
                <div className="flex items-center gap-2 bg-cyan-500/10 rounded-lg px-3 py-2 border border-cyan-500/20">
                  <span className="text-xl">{msg.giftEmoji}</span>
                  <div>
                    <span className="text-xs font-bold text-cyan-400">{msg.displayName ?? 'Guest'}</span>
                    <span className="text-xs text-zinc-300 ml-1">sent a {msg.giftName}!</span>
                  </div>
                  <span className="ml-auto text-xs text-cyan-500 font-mono">{msg.giftCost} pts</span>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className={cn(
                      'text-xs font-semibold shrink-0',
                      msg.userId === userId ? 'text-red-400' : 'text-zinc-300',
                    )}>
                      {msg.displayName ?? 'Guest'}
                    </span>
                    <span className="text-xs text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      {timeAgo(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-200 leading-snug mt-0.5 break-words">{msg.text}</p>
                </>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* ── Gift picker (mutually exclusive with emoji picker) ── */}
        {showGifts && (
          <div className="px-3 pt-3 border-t border-zinc-800 shrink-0 bg-zinc-950">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-zinc-400">Send a gift — creator gets 50%</p>
              {flavorBalance !== null && (
                <span className="text-xs text-cyan-400 font-mono">{flavorBalance.toLocaleString()} pts</span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {GIFT_CATALOG.map(g => {
                const canAfford = (flavorBalance ?? 0) >= g.cost
                return (
                  <button
                    key={g.id}
                    onClick={() => sendGift(g)}
                    disabled={sendingGift === g.id || !canAfford}
                    className={cn(
                      'flex flex-col items-center gap-0.5 p-2 rounded-lg border text-center transition-all',
                      !canAfford
                        ? 'border-zinc-800 opacity-40 cursor-not-allowed'
                        : 'border-zinc-700 hover:border-cyan-500/60 hover:bg-cyan-500/5 cursor-pointer',
                      sendingGift === g.id && 'opacity-50',
                    )}
                  >
                    <span className="text-xl">{g.emoji}</span>
                    <span className="text-[9px] text-zinc-400 leading-none line-clamp-1">{g.name}</span>
                    <span className="text-[9px] text-cyan-400 font-bold leading-none">{formatCost(g.cost)}</span>
                  </button>
                )
              })}
            </div>
            {flavorBalance === 0 && (
              <a href="/flavor" className="block text-center text-xs text-cyan-400 hover:underline mb-2">
                Get Flavor Points to send gifts →
              </a>
            )}
          </div>
        )}

        {/* ── Emoji picker (mutually exclusive with gift panel) ── */}
        {showEmojiPicker && (
          <div className="border-t border-zinc-800 shrink-0 bg-zinc-900">
            {/* Category tabs */}
            <div className="flex items-center border-b border-zinc-800">
              {EMOJI_CATEGORIES.map((cat, i) => (
                <button
                  key={cat.label}
                  // onMouseDown keeps input focused (doesn't trigger blur)
                  onMouseDown={e => { e.preventDefault(); setEmojiTab(i) }}
                  className={cn(
                    'flex-1 py-2 text-base transition-colors',
                    emojiTab === i ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  {cat.label}
                </button>
              ))}
              <button
                onMouseDown={e => { e.preventDefault(); setShowEmojiPicker(false) }}
                className="px-3 py-2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Emoji grid */}
            <div className="grid grid-cols-8 gap-0 p-2 max-h-36 overflow-y-auto">
              {EMOJI_CATEGORIES[emojiTab].emojis.map(emoji => (
                <button
                  key={emoji}
                  onMouseDown={e => { e.preventDefault(); insertEmoji(emoji) }}
                  className="text-xl p-1.5 hover:bg-zinc-700 rounded transition-colors leading-none"
                  aria-label={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick-reaction bar — visible when signed in ── */}
        {userId && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-zinc-800/50 shrink-0 bg-zinc-950/80">
            <span className="text-[10px] text-zinc-600 mr-0.5">React</span>
            {QUICK_REACTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="text-lg hover:scale-125 active:scale-90 transition-transform duration-100 p-0.5 rounded select-none"
                aria-label={`Send ${emoji} reaction`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* ── Input area ── */}
        <div className="px-3 py-3 border-t border-zinc-800 shrink-0">
          {userId ? (
            <div className="flex gap-1.5">
              {/* Gift button */}
              {creatorId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-9 w-9 shrink-0 text-zinc-400 hover:text-cyan-400',
                    showGifts && 'text-cyan-400 bg-cyan-500/10',
                  )}
                  onClick={() => { setShowGifts(s => !s); setShowEmojiPicker(false) }}
                  title="Send a gift"
                >
                  <Gift className="h-4 w-4" />
                </Button>
              )}

              {/* Emoji picker button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'h-9 w-9 shrink-0 text-zinc-400 hover:text-yellow-400',
                  showEmojiPicker && 'text-yellow-400 bg-yellow-500/10',
                )}
                onClick={() => { setShowEmojiPicker(s => !s); setShowGifts(false) }}
                title="Emoji picker"
              >
                <Smile className="h-4 w-4" />
              </Button>

              {/* Text input */}
              <Input
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value.slice(0, 200))}
                onKeyDown={handleKeyDown}
                placeholder="Say something..."
                className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-red-500 text-sm h-9 min-w-0"
              />

              {/* Send */}
              <Button
                onClick={sendMessage}
                disabled={!text.trim()}
                size="sm"
                className="bg-red-600 hover:bg-red-500 text-white shrink-0 h-9 px-3"
              >
                Send
              </Button>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 text-center py-1">
              <a href="/login" className="text-red-400 hover:text-red-300 underline underline-offset-2">
                Sign in
              </a>{' '}
              to chat and send gifts
            </p>
          )}
        </div>
      </div>
    </>
  )
}
