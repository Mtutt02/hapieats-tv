'use client'

import { useState, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Overlay } from './types'

interface StickerPanelProps {
  overlays: Overlay[]
  onOverlaysChange: (overlays: Overlay[]) => void
  videoDuration: number
}

const FOOD_EMOJIS = [
  '🍕', '🍔', '🌮', '🥗', '🍣', '🍜', '🍝', '🥩', '🌯', '🥙',
  '🧁', '🍰', '🎂', '🍪', '🍩', '🍿', '🥨', '🥐', '🥖', '🧀',
  '🥚', '🍳', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🥪',
  '🥫', '🍱', '🍛', '🍲', '🥘', '🥣', '🧆', '🍙', '🍚', '🥟',
  '🦐', '🦞', '🦀', '🐟', '🐠', '🐡', '🦈', '🍤', '🥠', '🥡',
  '🍨', '🍧', '🍦', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍡',
  '🥤', '🧋', '🫙', '🧂', '🥄', '🔪', '🍽️', '🏆', '⭐', '🔥',
  '💯', '✨', '❤️', '🎉', '👨‍🍳', '👩‍🍳', '😋', '🤤', '😍', '🥰',
]

const PRESET_POSITIONS: { label: string; x: number; y: number }[] = [
  { label: 'Top', x: 50, y: 10 },
  { label: 'Center', x: 50, y: 50 },
  { label: 'Bottom', x: 50, y: 85 },
  { label: 'Top Left', x: 15, y: 10 },
  { label: 'Top Right', x: 85, y: 10 },
]

export default function StickerPanel({ overlays, onOverlaysChange, videoDuration }: StickerPanelProps) {
  const [emojiSize, setEmojiSize] = useState(48)
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(videoDuration)
  const [searchQuery, setSearchQuery] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)

  const emojiOverlays = overlays.filter(o => o.type === 'emoji')

  const filteredEmojis = searchQuery
    ? FOOD_EMOJIS.filter(e => e.includes(searchQuery))
    : FOOD_EMOJIS

  const addEmoji = (emoji: string) => {
    const newOverlay: Overlay = {
      id: `emoji-${Date.now()}`,
      type: 'emoji',
      content: emoji,
      x: position.x,
      y: position.y,
      size: emojiSize,
      startTime,
      endTime: Math.min(endTime, videoDuration),
    }
    onOverlaysChange([...overlays, newOverlay])
  }

  const removeOverlay = (id: string) => {
    onOverlaysChange(overlays.filter(o => o.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Emoji grid search */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search emoji..."
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Controls row */}
      <div className="space-y-3">
        {/* Size slider */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-zinc-500 shrink-0 w-12">Size:</label>
          <input
            type="range"
            min="24"
            max="120"
            step="4"
            value={emojiSize}
            onChange={e => setEmojiSize(Number(e.target.value))}
            className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-800 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <span className="text-xs text-zinc-500 w-6 text-right">{emojiSize}</span>
          <span className="text-xl" style={{ fontSize: `${emojiSize * 0.3}px` }}>🍕</span>
        </div>

        {/* Position presets */}
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Position</label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_POSITIONS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPosition({ x: p.x, y: p.y })}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                  position.x === p.x && position.y === p.y
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Time range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Start (s)</label>
            <input
              type="number"
              min={0}
              max={videoDuration}
              step={0.1}
              value={startTime}
              onChange={e => setStartTime(Number(e.target.value))}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">End (s)</label>
            <input
              type="number"
              min={0}
              max={videoDuration}
              step={0.1}
              value={endTime}
              onChange={e => setEndTime(Number(e.target.value))}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Emoji grid */}
      <div
        ref={gridRef}
        className="grid grid-cols-10 gap-1.5 max-h-48 overflow-y-auto p-2 rounded-xl bg-zinc-900/50 border border-zinc-800"
      >
        {filteredEmojis.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            onClick={() => addEmoji(emoji)}
            className="aspect-square flex items-center justify-center text-2xl rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
        {filteredEmojis.length === 0 && (
          <div className="col-span-10 text-center py-8 text-zinc-600 text-sm">No emojis found</div>
        )}
      </div>

      {/* Added sticker overlays */}
      {emojiOverlays.length > 0 && (
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
            Added ({emojiOverlays.length})
          </h3>
          {emojiOverlays.map(overlay => (
            <div
              key={overlay.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/50 border border-zinc-800 group"
            >
              <span className="text-xl">{overlay.content}</span>
              <span className="text-[11px] text-zinc-600 font-mono">
                {overlay.startTime}s → {overlay.endTime}s
              </span>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeOverlay(overlay.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
