'use client'

// ============================================================
// HapiEats TV Studio — Editor Store (zustand)
// Project state, selection, playback state, undo/redo history.
// ============================================================

import { create } from 'zustand'
import {
  EditorProject, Track, Clip, MediaAsset, TrackKind, Keyframe, AnimatableProp,
  newProject, uid, projectDuration, defaultClip,
} from './types'
import { upsertKeyframe } from './interpolate'

const HISTORY_LIMIT = 100

interface EditorState {
  project: EditorProject
  selectedClipId: string | null
  selectedTrackId: string | null
  currentTime: number
  playing: boolean
  zoom: number // px per second
  snapping: boolean
  past: EditorProject[]
  future: EditorProject[]
  dirty: boolean

  // ---- lifecycle ----
  loadProject: (p: EditorProject) => void
  reset: (title?: string) => void
  setTitle: (t: string) => void
  setAspect: (a: EditorProject['aspect']) => void

  // ---- playback ----
  setTime: (t: number) => void
  setPlaying: (p: boolean) => void
  setZoom: (z: number) => void
  toggleSnapping: () => void

  // ---- selection ----
  select: (clipId: string | null, trackId?: string | null) => void

  // ---- assets ----
  addAsset: (a: MediaAsset) => void
  removeAsset: (id: string) => void

  // ---- tracks ----
  addTrack: (kind: TrackKind) => Track
  removeTrack: (id: string) => void
  updateTrack: (id: string, patch: Partial<Track>) => void
  moveTrack: (id: string, dir: -1 | 1) => void

  // ---- clips ----
  addClip: (trackId: string, clip: Clip) => void
  updateClip: (clipId: string, patch: Partial<Clip>, commit?: boolean) => void
  moveClip: (clipId: string, toTrackId: string, newStart: number) => void
  removeClip: (clipId: string) => void
  splitClip: (clipId: string, atTime: number) => void
  duplicateClip: (clipId: string) => void
  setKeyframe: (clipId: string, prop: AnimatableProp, kf: Keyframe) => void
  removeKeyframe: (clipId: string, prop: AnimatableProp, t: number) => void

  // ---- history ----
  commit: () => void
  undo: () => void
  redo: () => void
  markSaved: () => void
}

function findClip(p: EditorProject, clipId: string): { track: Track; clip: Clip; index: number } | null {
  for (const track of p.tracks) {
    const index = track.clips.findIndex(c => c.id === clipId)
    if (index >= 0) return { track, clip: track.clips[index], index }
  }
  return null
}

/** structuredClone with fallback */
const clone = <T,>(o: T): T =>
  typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o))

export const useEditor = create<EditorState>((set, get) => {
  const push = (mutate: (p: EditorProject) => void, commit = true) => {
    const { project, past } = get()
    const next = clone(project)
    mutate(next)
    next.updatedAt = Date.now()
    set({
      project: next,
      dirty: true,
      ...(commit
        ? { past: [...past.slice(-HISTORY_LIMIT), project], future: [] }
        : {}),
    })
  }

  return {
    project: newProject(),
    selectedClipId: null,
    selectedTrackId: null,
    currentTime: 0,
    playing: false,
    zoom: 60,
    snapping: true,
    past: [],
    future: [],
    dirty: false,

    loadProject: (p) => set({ project: p, past: [], future: [], selectedClipId: null, currentTime: 0, playing: false, dirty: false }),
    reset: (title) => set({ project: newProject(title), past: [], future: [], selectedClipId: null, currentTime: 0, playing: false, dirty: false }),
    setTitle: (t) => push(p => { p.title = t }),
    setAspect: (a) => push(p => { p.aspect = a }),

    setTime: (t) => {
      const dur = Math.max(projectDuration(get().project), 0)
      set({ currentTime: Math.max(0, Math.min(t, dur)) })
    },
    setPlaying: (playing) => set({ playing }),
    setZoom: (zoom) => set({ zoom: Math.max(8, Math.min(400, zoom)) }),
    toggleSnapping: () => set(s => ({ snapping: !s.snapping })),

    select: (clipId, trackId = null) => set({ selectedClipId: clipId, selectedTrackId: trackId }),

    addAsset: (a) => push(p => { p.assets.push(a) }),
    removeAsset: (id) => push(p => {
      p.assets = p.assets.filter(a => a.id !== id)
      for (const tr of p.tracks) tr.clips = tr.clips.filter(c => c.assetId !== id)
    }),

    addTrack: (kind) => {
      const count = get().project.tracks.filter(t => t.kind === kind).length
      const track: Track = { id: uid(), kind, label: `${kind[0].toUpperCase()}${kind.slice(1)} ${count + 1}`, clips: [], muted: false, locked: false, hidden: false }
      push(p => {
        // video tracks render bottom-up: append above existing video tracks
        if (kind === 'video') {
          const lastVideo = p.tracks.map(t => t.kind).lastIndexOf('video')
          p.tracks.splice(lastVideo + 1, 0, track)
        } else p.tracks.push(track)
      })
      return track
    },
    removeTrack: (id) => push(p => { p.tracks = p.tracks.filter(t => t.id !== id) }),
    updateTrack: (id, patch) => push(p => {
      const t = p.tracks.find(t => t.id === id)
      if (t) Object.assign(t, patch)
    }),
    moveTrack: (id, dir) => push(p => {
      const i = p.tracks.findIndex(t => t.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= p.tracks.length) return
      const [t] = p.tracks.splice(i, 1)
      p.tracks.splice(j, 0, t)
    }),

    addClip: (trackId, clip) => push(p => {
      const t = p.tracks.find(t => t.id === trackId)
      if (t) t.clips.push(clip)
    }),
    updateClip: (clipId, patch, commit = true) => push(p => {
      const found = findClip(p, clipId)
      if (found) Object.assign(found.clip, patch)
    }, commit),
    moveClip: (clipId, toTrackId, newStart) => push(p => {
      const found = findClip(p, clipId)
      const dest = p.tracks.find(t => t.id === toTrackId)
      if (!found || !dest) return
      found.track.clips.splice(found.index, 1)
      found.clip.start = Math.max(0, newStart)
      dest.clips.push(found.clip)
    }),
    removeClip: (clipId) => {
      push(p => {
        const found = findClip(p, clipId)
        if (found) found.track.clips.splice(found.index, 1)
      })
      if (get().selectedClipId === clipId) set({ selectedClipId: null })
    },
    splitClip: (clipId, atTime) => push(p => {
      const found = findClip(p, clipId)
      if (!found) return
      const { clip, track, index } = found
      const local = atTime - clip.start
      if (local <= 0.05 || local >= clip.duration - 0.05) return
      const right = clone(clip)
      right.id = uid()
      right.start = atTime
      right.duration = clip.duration - local
      right.in = clip.in + local * clip.speed
      right.fadeIn = 0
      right.transitionIn = { type: 'none', duration: 0.5 }
      // shift keyframes into each half
      for (const prop of Object.keys(clip.keyframes) as AnimatableProp[]) {
        const kfs = clip.keyframes[prop] || []
        clip.keyframes[prop] = kfs.filter(k => k.t <= local)
        right.keyframes[prop] = kfs.filter(k => k.t > local).map(k => ({ ...k, t: k.t - local }))
      }
      clip.duration = local
      clip.fadeOut = 0
      track.clips.splice(index + 1, 0, right)
    }),
    duplicateClip: (clipId) => push(p => {
      const found = findClip(p, clipId)
      if (!found) return
      const dup = clone(found.clip)
      dup.id = uid()
      dup.start = found.clip.start + found.clip.duration
      found.track.clips.splice(found.index + 1, 0, dup)
    }),
    setKeyframe: (clipId, prop, kf) => push(p => {
      const found = findClip(p, clipId)
      if (!found) return
      found.clip.keyframes[prop] = upsertKeyframe(found.clip.keyframes[prop], kf)
    }),
    removeKeyframe: (clipId, prop, t) => push(p => {
      const found = findClip(p, clipId)
      if (!found) return
      found.clip.keyframes[prop] = (found.clip.keyframes[prop] || []).filter(k => Math.abs(k.t - t) > 0.033)
    }),

    commit: () => { /* push() commits by default; explicit no-op for drag-end semantics */ },
    undo: () => {
      const { past, future, project } = get()
      if (past.length === 0) return
      const prev = past[past.length - 1]
      set({ project: prev, past: past.slice(0, -1), future: [project, ...future].slice(0, HISTORY_LIMIT), dirty: true })
    },
    redo: () => {
      const { past, future, project } = get()
      if (future.length === 0) return
      const [next, ...rest] = future
      set({ project: next, past: [...past, project], future: rest, dirty: true })
    },
    markSaved: () => set({ dirty: false }),
  }
})

/** Convenience: currently selected clip (or null). */
export function getSelectedClip(state: Pick<EditorState, 'project' | 'selectedClipId'>): Clip | null {
  if (!state.selectedClipId) return null
  for (const t of state.project.tracks) {
    const c = t.clips.find(c => c.id === state.selectedClipId)
    if (c) return c
  }
  return null
}

export { defaultClip }
