'use client'

import { useState } from 'react'
import { Plus, X, MoveUp, MoveDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Overlay } from './types'

interface TextOverlayPanelProps {
  overlays: Overlay[]
  onOverlaysChange: (overlays: Overlay[]) => void
  videoDuration: number
}

const PRESET_COLORS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Black', value: '#000000' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Gold', value: '#c9a84c' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Orange', value: '#f97316' },
]

const FONT_SIZES = [16, 24, 32, 40, 48, 64, 80]

const PRESET_POSITIONS: { label: string; x: number; y: number }[] = [
  { label: 'Top', x: 50, y: 10 },
  { label: 'Center', x: 50, y: 50 },
  { label: 'Bottom', x: 50, y: 85 },
]

export default function TextOverlayPanel({ overlays, onOverlaysChange, videoDuration }: TextOverlayPanelProps) {
  const [text, setText] = useState('')
  const [fontSize, setFontSize] = useState(40)
  const [color, setColor] = useState('#ffffff')
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(videoDuration)

  const textOverlays = overlays.filter(o => o.type === 'text')

  const addOverlay = () => {
    if (!text.trim()) return
    const newOverlay: Overlay = {
      id: `text-${Date.now()}`,
      type: 'text',
      content: text.trim(),
      x: position.x,
      y: position.y,
      fontSize,
      color,
      startTime,
      endTime: Math.min(endTime, videoDuration),
    }
    onOverlaysChange([...overlays, newOverlay])
    setText('')
  }

  const removeOverlay = (id: string) => {
    onOverlaysChange(overlays.filter(o => o.id !== id))
  }

  const moveOverlay = (idx: number, direction: 'up' | 'down') => {
    const filtered = textOverlays
    const globalIndices = filtered.map(o => overlays.findIndex(ov => ov.id === o.id))
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= globalIndices.length) return

    const arr = [...overlays]
    const a = globalIndices[idx]
    const b = globalIndices[newIdx]
    ;[arr[a], arr[b]] = [arr[b], arr[a]]
    onOverlaysChange(arr)
  }

  return (
    <div className="space-y-5">
      {/* Add new text overlay */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Add Text Overlay</h3>

        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Text</label>
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Enter your text..."
            className="text-base"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Font Size</label>
            <select
              value={fontSize}
              onChange={e => setFontSize(Number(e.target.value))}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {FONT_SIZES.map(s => (
                <option key={s} value={s}>{s}px</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    'w-8 h-8 rounded-lg border-2 transition-all',
                    color === c.value ? 'border-primary scale-110' : 'border-transparent hover:border-zinc-600'
                  )}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Position presets */}
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Position</label>
          <div className="flex gap-2">
            {PRESET_POSITIONS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPosition({ x: p.x, y: p.y })}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs border transition-all',
                  position.x === p.x && position.y === p.y
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Time range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Start Time (s)</label>
            <Input
              type="number"
              min={0}
              max={videoDuration}
              step={0.1}
              value={startTime}
              onChange={e => setStartTime(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">End Time (s)</label>
            <Input
              type="number"
              min={0}
              max={videoDuration}
              step={0.1}
              value={endTime}
              onChange={e => setEndTime(Number(e.target.value))}
            />
          </div>
        </div>

        <Button onClick={addOverlay} disabled={!text.trim()} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Add Text
        </Button>
      </div>

      {/* Overlay list */}
      {textOverlays.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
            Added Text ({textOverlays.length})
          </h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {textOverlays.map((overlay, idx) => (
              <div
                key={overlay.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/50 border border-zinc-800 group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: overlay.color }}>
                    {overlay.content}
                  </p>
                  <p className="text-[11px] text-zinc-600 font-mono">
                    {overlay.startTime}s → {overlay.endTime}s
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveOverlay(idx, 'up')}
                    disabled={idx === 0}
                  >
                    <MoveUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveOverlay(idx, 'down')}
                    disabled={idx === textOverlays.length - 1}
                  >
                    <MoveDown className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400 hover:text-red-300"
                    onClick={() => removeOverlay(overlay.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview hint */}
      <div className="p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/50 text-xs text-zinc-500">
        Text overlays will render on the video at their specified time range.
      </div>
    </div>
  )
}
