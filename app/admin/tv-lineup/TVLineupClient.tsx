'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Tv, Loader2, Check, X, GripVertical, Radio, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface HapiChannel {
  id: string
  name: string
  slug: string
}

interface LineupSlot {
  id: string
  channel_number: number
  name: string
  icon: string
  description: string
  category: string
  mux_playback_id: string | null
  video_url: string | null
  is_active: boolean
  channel: HapiChannel | null
}

type ContentSource = 'channel' | 'mux' | 'url' | 'none'

interface SlotForm {
  channel_number: string
  name: string
  icon: string
  description: string
  category: string
  source: ContentSource
  channel_id: string
  mux_playback_id: string
  video_url: string
}

const EMPTY_FORM: SlotForm = {
  channel_number: '',
  name: '',
  icon: '📺',
  description: '',
  category: 'General',
  source: 'none',
  channel_id: '',
  mux_playback_id: '',
  video_url: '',
}

const CATEGORIES = ['General', 'Japanese', 'Italian', 'Mexican', 'BBQ', 'Baking', 'Street Food', 'Plant-Based', 'Desserts', 'Techniques', 'LIVE']

const EMOJI_PRESETS = ['📺', '🍣', '🌮', '🔥', '🥐', '🍝', '🌱', '🍫', '🍽️', '📡', '🍜', '🥩', '🍕', '🥗', '🍰', '🌶️', '🦐', '🥘', '🫕', '🍤']

// ── Slot Form ──────────────────────────────────────────────────────────────────

function SlotFormPanel({
  channels,
  initial,
  onSave,
  onCancel,
  saving,
}: {
  channels: HapiChannel[]
  initial: SlotForm
  onSave: (form: SlotForm) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<SlotForm>(initial)
  const set = (k: keyof SlotForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const sourceLabel: Record<ContentSource, string> = {
    channel: 'HapiEats Channel',
    mux: 'Mux Playback ID',
    url: 'Video URL',
    none: 'No content yet',
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Channel number */}
        <div>
          <Label htmlFor="chnum">Channel Number *</Label>
          <Input
            id="chnum"
            type="number"
            min={1}
            max={999}
            placeholder="e.g. 6"
            value={form.channel_number}
            onChange={e => set('channel_number', e.target.value)}
            className="mt-1.5 font-mono text-lg"
          />
        </div>

        {/* Icon */}
        <div>
          <Label>Icon</Label>
          <div className="mt-1.5 flex gap-1.5 flex-wrap">
            {EMOJI_PRESETS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => set('icon', e)}
                className={cn(
                  'h-8 w-8 text-lg rounded-lg border transition-colors',
                  form.icon === e
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-border/80 bg-muted/20',
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Name */}
      <div>
        <Label htmlFor="chname">Channel Name *</Label>
        <Input
          id="chname"
          placeholder="e.g. Japanese Kitchen"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          className="mt-1.5"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Description */}
        <div>
          <Label htmlFor="chdesc">Description</Label>
          <Input
            id="chdesc"
            placeholder="Short tagline"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            className="mt-1.5"
          />
        </div>

        {/* Category */}
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => set('category', v)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content source */}
      <div>
        <Label>Content Source</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
          {(['channel', 'mux', 'url', 'none'] as ContentSource[]).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => set('source', s)}
              className={cn(
                'py-2 px-3 rounded-xl border text-xs font-medium transition-colors',
                form.source === s
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {sourceLabel[s]}
            </button>
          ))}
        </div>
      </div>

      {form.source === 'channel' && (
        <div>
          <Label>HapiEats Channel</Label>
          <Select value={form.channel_id} onValueChange={v => set('channel_id', v)}>
            <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select a channel" /></SelectTrigger>
            <SelectContent>
              {channels.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            The TV slot will play the latest video from this channel, and switch to live if the channel goes live.
          </p>
        </div>
      )}

      {form.source === 'mux' && (
        <div>
          <Label htmlFor="muxid">Mux Playback ID</Label>
          <Input
            id="muxid"
            placeholder="VZtzUzGRv02OhRnZCxcNg49OilvolTqdnFLEqNtq3moA"
            value={form.mux_playback_id}
            onChange={e => set('mux_playback_id', e.target.value)}
            className="mt-1.5 font-mono text-sm"
          />
        </div>
      )}

      {form.source === 'url' && (
        <div>
          <Label htmlFor="vidurl">Video URL (MP4)</Label>
          <Input
            id="vidurl"
            placeholder="https://..."
            value={form.video_url}
            onChange={e => set('video_url', e.target.value)}
            className="mt-1.5"
          />
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          onClick={() => onSave(form)}
          disabled={saving || !form.channel_number || !form.name}
          className="gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save Channel'}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          <X className="h-4 w-4 mr-1.5" /> Cancel
        </Button>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TVLineupClient({ lineup: initial, channels }: {
  lineup: LineupSlot[]
  channels: HapiChannel[]
}) {
  const router = useRouter()
  const [lineup, setLineup] = useState<LineupSlot[]>(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function formToPayload(form: SlotForm) {
    return {
      channel_number: Number(form.channel_number),
      name: form.name.trim(),
      icon: form.icon,
      description: form.description.trim(),
      category: form.category,
      channel_id: form.source === 'channel' ? form.channel_id || null : null,
      mux_playback_id: form.source === 'mux' ? form.mux_playback_id.trim() || null : null,
      video_url: form.source === 'url' ? form.video_url.trim() || null : null,
    }
  }

  const handleAdd = async (form: SlotForm) => {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/admin/tv-lineup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(form)),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create')
      setLineup(prev => [...prev, json.slot].sort((a, b) => a.channel_number - b.channel_number))
      setShowAdd(false)
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (id: string, form: SlotForm) => {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/tv-lineup/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(form)),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update')
      setLineup(prev =>
        prev.map(s => s.id === id ? { ...s, ...json.slot } : s)
            .sort((a, b) => a.channel_number - b.channel_number)
      )
      setEditId(null)
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (slot: LineupSlot) => {
    const res = await fetch(`/api/admin/tv-lineup/${slot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !slot.is_active }),
    })
    if (res.ok) {
      setLineup(prev => prev.map(s => s.id === slot.id ? { ...s, is_active: !s.is_active } : s))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this channel from the TV lineup?')) return
    const res = await fetch(`/api/admin/tv-lineup/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setLineup(prev => prev.filter(s => s.id !== id))
    }
  }

  function slotToForm(slot: LineupSlot): SlotForm {
    let source: ContentSource = 'none'
    if (slot.channel)          source = 'channel'
    else if (slot.mux_playback_id) source = 'mux'
    else if (slot.video_url)       source = 'url'
    return {
      channel_number: String(slot.channel_number),
      name:           slot.name,
      icon:           slot.icon,
      description:    slot.description,
      category:       slot.category,
      source,
      channel_id:     slot.channel?.id ?? '',
      mux_playback_id: slot.mux_playback_id ?? '',
      video_url:      slot.video_url ?? '',
    }
  }

  function contentLabel(slot: LineupSlot) {
    if (slot.channel) return <span className="text-primary">{slot.channel.name}</span>
    if (slot.mux_playback_id) return <span className="font-mono text-xs text-zinc-400">{slot.mux_playback_id.slice(0, 18)}…</span>
    if (slot.video_url) return <span className="text-zinc-400 text-xs">External URL</span>
    return <span className="text-zinc-600 italic">No content</span>
  }

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/30">
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Add button */}
      {!showAdd && (
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Channel Slot
        </Button>
      )}

      {/* Add form */}
      {showAdd && (
        <SlotFormPanel
          channels={channels}
          initial={EMPTY_FORM}
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
          saving={saving}
        />
      )}

      {/* Lineup list */}
      {lineup.length === 0 && !showAdd ? (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
          <Tv className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-semibold mb-1">No channels in the lineup yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Add your first channel slot to assign a fixed channel number.
          </p>
          <Button onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add First Channel
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {lineup.map(slot => (
            <div key={slot.id}>
              {editId === slot.id ? (
                <SlotFormPanel
                  channels={channels}
                  initial={slotToForm(slot)}
                  onSave={form => handleEdit(slot.id, form)}
                  onCancel={() => setEditId(null)}
                  saving={saving}
                />
              ) : (
                <div className={cn(
                  'flex items-center gap-4 p-4 rounded-xl border bg-card transition-colors',
                  !slot.is_active && 'opacity-50',
                )}>
                  {/* Drag handle placeholder */}
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 cursor-grab" />

                  {/* Channel number badge */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-center flex-shrink-0 w-14">
                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">CH</p>
                    <p className="text-lg font-black font-mono text-white leading-none">
                      {String(slot.channel_number).padStart(2, '0')}
                    </p>
                  </div>

                  {/* Icon + name */}
                  <div className="flex items-center gap-2 flex-shrink-0 w-48">
                    <span className="text-2xl">{slot.icon}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{slot.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{slot.category}</p>
                    </div>
                  </div>

                  {/* Content source */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    {slot.channel ? (
                      <span className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                        <Tv className="h-3 w-3" /> {slot.channel.name}
                      </span>
                    ) : slot.mux_playback_id ? (
                      <span className="flex items-center gap-1.5 text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded-full font-medium">
                        <Radio className="h-3 w-3" /> Mux: {slot.mux_playback_id.slice(0, 12)}…
                      </span>
                    ) : slot.video_url ? (
                      <span className="text-xs text-zinc-400 font-medium">External URL</span>
                    ) : (
                      <span className="text-xs text-zinc-600 italic">No content</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleActive(slot)}
                      title={slot.is_active ? 'Hide from TV' : 'Show on TV'}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {slot.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => setEditId(slot.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(slot.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lineup.length > 0 && (
        <div className="text-xs text-muted-foreground pt-2 flex items-center gap-1.5">
          <Tv className="h-3.5 w-3.5" />
          {lineup.filter(s => s.is_active).length} active channel{lineup.filter(s => s.is_active).length !== 1 ? 's' : ''} in lineup —
          viewers can type CH{lineup.filter(s => s.is_active).slice(0,3).map(s => String(s.channel_number).padStart(2,'0')).join(', CH')} on the remote
        </div>
      )}
    </div>
  )
}
