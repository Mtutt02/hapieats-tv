'use client'

// ============================================================
// HapiEats TV Studio — Inspector
// Context panel for the selected clip: transform + keyframes,
// speed ramp, transitions, filters, audio (volume envelope,
// fades), and text styling.
// ============================================================

import { useState } from 'react'
import { Diamond, Gauge, Wand2, SlidersHorizontal, Volume2, Type as TypeIcon, Trash2, Crown } from 'lucide-react'
import { useEditor, getSelectedClip } from '@/lib/editor/store'
import { AnimatableProp, TransitionType, DEFAULT_TEXT_STYLE, ClipFilters } from '@/lib/editor/types'
import { usePremium } from './usePremium'

const TRANSITIONS: { id: TransitionType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'fade', label: 'Fade' },
  { id: 'slide-left', label: 'Slide ←' },
  { id: 'slide-right', label: 'Slide →' },
  { id: 'slide-up', label: 'Slide ↑' },
  { id: 'wipe', label: 'Wipe' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'blur', label: 'Blur' },
]

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

const FILTER_PRESETS = ['none', 'vintage', 'noir', 'cinematic', 'warm', 'cool', 'dramatic', 'golden', 'fresh']

const FONTS = [
  'Inter, system-ui, sans-serif',
  'Georgia, serif',
  '"Courier New", monospace',
  '"Comic Sans MS", cursive',
  'Impact, sans-serif',
]

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="w-20 shrink-0 text-[11px] text-zinc-400">{label}</span>
      <div className="flex flex-1 items-center gap-1.5">{children}</div>
    </div>
  )
}

function Slider({ value, min, max, step = 1, onChange, onCommit }: {
  value: number; min: number; max: number; step?: number
  onChange: (v: number) => void; onCommit?: () => void
}) {
  return (
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      onMouseUp={onCommit} onTouchEnd={onCommit}
      className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-800 accent-emerald-500"
    />
  )
}

export default function InspectorPanel() {
  const project = useEditor(s => s.project)
  const selectedClipId = useEditor(s => s.selectedClipId)
  const currentTime = useEditor(s => s.currentTime)
  const { updateClip, setKeyframe, removeKeyframe } = useEditor()
  const { limits, gate, isPremium } = usePremium()
  const [section, setSection] = useState<'transform' | 'speed' | 'filters' | 'audio' | 'text'>('transform')

  const clip = getSelectedClip({ project, selectedClipId })

  if (!clip) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-xs text-zinc-500">
        Select a clip on the timeline to edit its properties
      </div>
    )
  }

  const local = Math.max(0, Math.min(currentTime - clip.start, clip.duration))
  const isAudioCapable = clip.kind === 'video' || clip.kind === 'audio'
  const isVisual = clip.kind !== 'audio'
  const isText = clip.kind === 'text' || clip.kind === 'sticker'

  const setTransform = (prop: AnimatableProp, v: number, commit = false) =>
    updateClip(clip.id, { transform: { ...clip.transform, [prop]: v } }, commit)

  const addKf = (prop: AnimatableProp) => {
    if (!limits.keyframes) { gate('Keyframe animation'); return }
    setKeyframe(clip.id, prop, { t: local, v: clip.transform[prop], ease: 'easeInOut' })
  }

  const kfButton = (prop: AnimatableProp) => {
    const kfs = clip.keyframes[prop] || []
    const onKf = kfs.some(k => Math.abs(k.t - local) < 0.05)
    return (
      <button
        onClick={() => onKf ? removeKeyframe(clip.id, prop, local) : addKf(prop)}
        className={`rounded p-1 ${onKf ? 'text-amber-400' : kfs.length ? 'text-emerald-400' : 'text-zinc-600'} hover:bg-zinc-800`}
        title={limits.keyframes ? 'Toggle keyframe at playhead' : 'Keyframes — Studio Pro'}
      >
        <Diamond className="h-3 w-3" fill={onKf ? 'currentColor' : 'none'} />
      </button>
    )
  }

  const setFilters = (patch: Partial<ClipFilters>, commit = true) =>
    updateClip(clip.id, { filters: { ...clip.filters, ...patch } }, commit)

  const style = clip.textStyle || DEFAULT_TEXT_STYLE

  const tabs = [
    { id: 'transform' as const, icon: Wand2, show: isVisual },
    { id: 'speed' as const, icon: Gauge, show: clip.kind === 'video' || clip.kind === 'audio' },
    { id: 'filters' as const, icon: SlidersHorizontal, show: isVisual && !isText },
    { id: 'audio' as const, icon: Volume2, show: isAudioCapable },
    { id: 'text' as const, icon: TypeIcon, show: isText },
  ].filter(t => t.show)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-3 py-2">
        <span className="truncate text-xs font-bold text-white">{clip.label}</span>
        <span className="text-[10px] text-zinc-500">{clip.duration.toFixed(1)}s</span>
      </div>
      <div className="flex border-b border-zinc-800/80">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={`flex flex-1 items-center justify-center py-2 ${section === t.id ? 'border-b-2 border-emerald-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <t.icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {section === 'transform' && isVisual && (
          <div className="space-y-1">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Transform</p>
              {!limits.keyframes && (
                <button onClick={() => gate('Keyframe animation')} className="flex items-center gap-1 text-[10px] text-amber-400">
                  <Crown className="h-3 w-3" /> Keyframes
                </button>
              )}
            </div>
            {([
              ['x', 'Position X', -100, 100, 1],
              ['y', 'Position Y', -100, 100, 1],
              ['scale', 'Scale', 0.1, 4, 0.01],
              ['rotate', 'Rotation', -180, 180, 1],
              ['opacity', 'Opacity', 0, 1, 0.01],
            ] as [AnimatableProp, string, number, number, number][]).map(([prop, label, min, max, step]) => (
              <Row key={prop} label={label}>
                <Slider
                  value={clip.transform[prop]} min={min} max={max} step={step}
                  onChange={v => setTransform(prop, v)}
                  onCommit={() => setTransform(prop, clip.transform[prop], true)}
                />
                <span className="w-10 text-right font-mono text-[10px] text-zinc-400">
                  {prop === 'scale' || prop === 'opacity' ? clip.transform[prop].toFixed(2) : Math.round(clip.transform[prop])}
                </span>
                {kfButton(prop)}
              </Row>
            ))}

            <p className="mt-4 mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Transition in {!limits.transitions && <Crown className="ml-1 inline h-3 w-3 text-amber-400" />}</p>
            <div className="grid grid-cols-4 gap-1">
              {TRANSITIONS.map(tr => (
                <button
                  key={tr.id}
                  onClick={() => {
                    if (tr.id !== 'none' && !limits.transitions) { gate('Transitions'); return }
                    updateClip(clip.id, { transitionIn: { ...clip.transitionIn, type: tr.id } })
                  }}
                  className={`rounded-lg border px-1 py-1.5 text-[10px] ${clip.transitionIn.type === tr.id ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
                >
                  {tr.label}
                </button>
              ))}
            </div>
            {clip.transitionIn.type !== 'none' && (
              <Row label="Duration">
                <Slider value={clip.transitionIn.duration} min={0.2} max={3} step={0.1}
                  onChange={v => updateClip(clip.id, { transitionIn: { ...clip.transitionIn, duration: v } }, false)}
                  onCommit={() => updateClip(clip.id, {}, true)}
                />
                <span className="w-10 text-right font-mono text-[10px] text-zinc-400">{clip.transitionIn.duration.toFixed(1)}s</span>
              </Row>
            )}
          </div>
        )}

        {section === 'speed' && (
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wide text-zinc-500">Playback speed</p>
            <div className="grid grid-cols-3 gap-1.5">
              {SPEEDS.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    const realLen = clip.duration * clip.speed
                    updateClip(clip.id, { speed: s, duration: realLen / s })
                  }}
                  className={`rounded-lg border px-2 py-2 text-xs font-semibold ${clip.speed === s ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
                >
                  {s}x
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-zinc-500">
              {clip.speed < 1 ? 'Slow motion' : clip.speed > 1 ? 'Time-lapse' : 'Normal speed'} — clip runs {(clip.duration).toFixed(1)}s on the timeline.
            </p>
          </div>
        )}

        {section === 'filters' && (
          <div className="space-y-1">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-zinc-500">Preset</p>
            <div className="grid grid-cols-3 gap-1">
              {FILTER_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => setFilters({ preset: p === 'none' ? null : p })}
                  className={`rounded-lg border px-1 py-1.5 text-[10px] capitalize ${(clip.filters.preset || 'none') === p ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="pt-2">
              {([
                ['brightness', 'Brightness', -100, 100],
                ['contrast', 'Contrast', -100, 100],
                ['saturation', 'Saturation', -100, 100],
                ['warmth', 'Warmth', -100, 100],
                ['blur', 'Blur', 0, 20],
              ] as [keyof ClipFilters, string, number, number][]).map(([key, label, min, max]) => (
                <Row key={key} label={label}>
                  <Slider
                    value={clip.filters[key] as number} min={min} max={max}
                    onChange={v => setFilters({ [key]: v } as Partial<ClipFilters>, false)}
                    onCommit={() => setFilters({}, true)}
                  />
                  <span className="w-8 text-right font-mono text-[10px] text-zinc-400">{Math.round(clip.filters[key] as number)}</span>
                </Row>
              ))}
            </div>
          </div>
        )}

        {section === 'audio' && (
          <div className="space-y-1">
            <Row label="Volume">
              <Slider value={clip.volume} min={0} max={2} step={0.01}
                onChange={v => updateClip(clip.id, { volume: v }, false)}
                onCommit={() => updateClip(clip.id, {}, true)}
              />
              <span className="w-10 text-right font-mono text-[10px] text-zinc-400">{Math.round(clip.volume * 100)}%</span>
            </Row>
            <Row label="Mute">
              <button
                onClick={() => updateClip(clip.id, { muted: !clip.muted })}
                className={`rounded-lg border px-3 py-1 text-[11px] ${clip.muted ? 'border-red-500/60 bg-red-500/10 text-red-300' : 'border-zinc-800 text-zinc-400'}`}
              >
                {clip.muted ? 'Muted' : 'On'}
              </button>
            </Row>
            <Row label="Fade in">
              <Slider value={clip.fadeIn} min={0} max={5} step={0.1}
                onChange={v => updateClip(clip.id, { fadeIn: v }, false)}
                onCommit={() => updateClip(clip.id, {}, true)}
              />
              <span className="w-10 text-right font-mono text-[10px] text-zinc-400">{clip.fadeIn.toFixed(1)}s</span>
            </Row>
            <Row label="Fade out">
              <Slider value={clip.fadeOut} min={0} max={5} step={0.1}
                onChange={v => updateClip(clip.id, { fadeOut: v }, false)}
                onCommit={() => updateClip(clip.id, {}, true)}
              />
              <span className="w-10 text-right font-mono text-[10px] text-zinc-400">{clip.fadeOut.toFixed(1)}s</span>
            </Row>

            <p className="mt-4 mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Volume envelope</p>
            <p className="mb-2 text-[10px] text-zinc-600">Points shape the gain curve across the clip — use with fades for crossfading between overlapping audio.</p>
            <div className="space-y-1">
              {clip.volumeEnvelope.map((pt, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-12 font-mono text-[10px] text-zinc-500">{pt.t.toFixed(1)}s</span>
                  <Slider value={pt.v} min={0} max={2} step={0.01}
                    onChange={v => {
                      const env = clip.volumeEnvelope.map((p, j) => j === i ? { ...p, v } : p)
                      updateClip(clip.id, { volumeEnvelope: env }, false)
                    }}
                    onCommit={() => updateClip(clip.id, {}, true)}
                  />
                  <span className="w-8 text-right font-mono text-[10px] text-zinc-400">{Math.round(pt.v * 100)}%</span>
                  <button
                    onClick={() => updateClip(clip.id, { volumeEnvelope: clip.volumeEnvelope.filter((_, j) => j !== i) })}
                    className="text-zinc-600 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const env = [...clip.volumeEnvelope, { t: local, v: 1 }].sort((a, b) => a.t - b.t)
                  updateClip(clip.id, { volumeEnvelope: env })
                }}
                className="mt-1 w-full rounded-lg border border-dashed border-zinc-700 py-1.5 text-[11px] text-zinc-400 hover:border-zinc-500"
              >
                + Add point at playhead
              </button>
            </div>
          </div>
        )}

        {section === 'text' && isText && (
          <div className="space-y-1">
            <textarea
              value={clip.text || ''}
              onChange={e => updateClip(clip.id, { text: e.target.value }, false)}
              onBlur={() => updateClip(clip.id, {}, true)}
              rows={2}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Your text…"
            />
            <Row label="Font">
              <select
                value={style.fontFamily}
                onChange={e => updateClip(clip.id, { textStyle: { ...style, fontFamily: e.target.value } })}
                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-white"
              >
                {FONTS.map(f => <option key={f} value={f}>{f.split(',')[0].replace(/"/g, '')}</option>)}
              </select>
            </Row>
            <Row label="Size">
              <Slider value={style.fontSize} min={20} max={220}
                onChange={v => updateClip(clip.id, { textStyle: { ...style, fontSize: v } }, false)}
                onCommit={() => updateClip(clip.id, {}, true)}
              />
              <span className="w-8 text-right font-mono text-[10px] text-zinc-400">{Math.round(style.fontSize)}</span>
            </Row>
            <Row label="Color">
              <input type="color" value={style.color}
                onChange={e => updateClip(clip.id, { textStyle: { ...style, color: e.target.value } }, false)}
                className="h-7 w-12 cursor-pointer rounded border border-zinc-800 bg-transparent"
              />
              <button
                onClick={() => updateClip(clip.id, { textStyle: { ...style, bold: !style.bold } })}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${style.bold ? 'border-emerald-500 text-emerald-300' : 'border-zinc-800 text-zinc-400'}`}
              >B</button>
              <button
                onClick={() => updateClip(clip.id, { textStyle: { ...style, italic: !style.italic } })}
                className={`rounded-lg border px-2.5 py-1 text-[11px] italic ${style.italic ? 'border-emerald-500 text-emerald-300' : 'border-zinc-800 text-zinc-400'}`}
              >I</button>
              <button
                onClick={() => updateClip(clip.id, { textStyle: { ...style, outline: !style.outline } })}
                className={`rounded-lg border px-2 py-1 text-[11px] ${style.outline ? 'border-emerald-500 text-emerald-300' : 'border-zinc-800 text-zinc-400'}`}
              >Outline</button>
            </Row>
            <Row label="Backdrop">
              <button
                onClick={() => updateClip(clip.id, { textStyle: { ...style, background: style.background ? null : 'rgba(0,0,0,0.65)' } })}
                className={`rounded-lg border px-3 py-1 text-[11px] ${style.background ? 'border-emerald-500 text-emerald-300' : 'border-zinc-800 text-zinc-400'}`}
              >
                {style.background ? 'On' : 'Off'}
              </button>
            </Row>
            <p className="mt-3 mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Animation</p>
            <div className="grid grid-cols-3 gap-1">
              {(['none', 'pop', 'slide-up', 'typewriter', 'karaoke'] as const).map(a => (
                <button
                  key={a}
                  onClick={() => updateClip(clip.id, { textStyle: { ...style, animation: a } })}
                  className={`rounded-lg border px-1 py-1.5 text-[10px] capitalize ${style.animation === a ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
