// ============================================================
// HapiEats TV Studio — Editor Engine Types
// Multi-track, keyframable, layer-composited project model.
// ============================================================

export type AspectPreset = '16:9' | '9:16' | '1:1'

export const ASPECT_SIZES: Record<AspectPreset, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
}

export type EaseType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

export interface Keyframe {
  /** seconds relative to clip start (timeline-local) */
  t: number
  v: number
  ease: EaseType
}

/** Animatable clip properties. Values are static defaults; keyframes override. */
export interface ClipTransform {
  x: number // -100..100 (% offset from center)
  y: number
  scale: number // 1 = fit
  rotate: number // degrees
  opacity: number // 0..1
}

export type AnimatableProp = keyof ClipTransform

export interface ClipFilters {
  brightness: number // -100..100
  contrast: number
  saturation: number
  warmth: number
  blur: number // 0..20
  preset: string | null
}

export const DEFAULT_CLIP_FILTERS: ClipFilters = {
  brightness: 0, contrast: 0, saturation: 0, warmth: 0, blur: 0, preset: null,
}

export type TransitionType = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'wipe' | 'zoom' | 'blur'

export interface Transition {
  type: TransitionType
  duration: number // seconds
}

export interface VolumePoint {
  /** seconds relative to clip start */
  t: number
  /** 0..2 gain */
  v: number
}

export interface TextStyle {
  fontFamily: string
  fontSize: number // px at project resolution
  color: string
  bold: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
  background: string | null // rgba or null
  outline: boolean
  animation: 'none' | 'pop' | 'slide-up' | 'typewriter' | 'karaoke'
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 72,
  color: '#ffffff',
  bold: true,
  italic: false,
  align: 'center',
  background: null,
  outline: true,
  animation: 'none',
}

export type ClipKind = 'video' | 'image' | 'audio' | 'text' | 'sticker'

export interface Clip {
  id: string
  kind: ClipKind
  label: string
  /** asset id in media pool (video/image/audio) */
  assetId?: string
  /** timeline position, seconds */
  start: number
  /** timeline duration, seconds (already divided by speed) */
  duration: number
  /** source in-point, seconds */
  in: number
  /** playback rate. 1 = normal, 0.25..4 */
  speed: number
  transform: ClipTransform
  keyframes: Partial<Record<AnimatableProp, Keyframe[]>>
  filters: ClipFilters
  /** base volume 0..2 (audio + video clips) */
  volume: number
  muted: boolean
  volumeEnvelope: VolumePoint[]
  fadeIn: number // seconds (audio fade)
  fadeOut: number
  transitionIn: Transition
  /** text / sticker payload */
  text?: string
  textStyle?: TextStyle
  /** AI background removal (premium) */
  removeBackground?: boolean
}

export type TrackKind = 'video' | 'audio' | 'text'

export interface Track {
  id: string
  kind: TrackKind
  label: string
  clips: Clip[]
  muted: boolean
  locked: boolean
  hidden: boolean
}

export interface MediaAsset {
  id: string
  kind: 'video' | 'image' | 'audio'
  name: string
  /** object URL (runtime) — rebuilt from IndexedDB blob on load */
  url: string
  duration: number
  width?: number
  height?: number
  /** remote source (library videos) — persisted instead of blob */
  remoteUrl?: string
  /** Mux asset/playback ids when sourced from the library */
  muxAssetId?: string
  muxPlaybackId?: string
}

export interface EditorProject {
  id: string
  title: string
  aspect: AspectPreset
  tracks: Track[]
  assets: MediaAsset[]
  createdAt: number
  updatedAt: number
}

export interface CaptionCue {
  start: number
  end: number
  text: string
}

// ---------- helpers ----------

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export function projectDuration(p: EditorProject): number {
  let end = 0
  for (const tr of p.tracks) for (const c of tr.clips) end = Math.max(end, c.start + c.duration)
  return end
}

export function clipAt(track: Track, time: number): Clip | undefined {
  return track.clips.find(c => time >= c.start && time < c.start + c.duration)
}

export function newProject(title = 'Untitled project', aspect: AspectPreset = '16:9'): EditorProject {
  return {
    id: uid(),
    title,
    aspect,
    tracks: [
      { id: uid(), kind: 'video', label: 'Video 1', clips: [], muted: false, locked: false, hidden: false },
      { id: uid(), kind: 'text', label: 'Text', clips: [], muted: false, locked: false, hidden: false },
      { id: uid(), kind: 'audio', label: 'Audio 1', clips: [], muted: false, locked: false, hidden: false },
    ],
    assets: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function defaultClip(kind: ClipKind, partial: Partial<Clip> = {}): Clip {
  return {
    id: uid(),
    kind,
    label: partial.label || kind,
    start: 0,
    duration: 4,
    in: 0,
    speed: 1,
    transform: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
    keyframes: {},
    filters: { ...DEFAULT_CLIP_FILTERS },
    volume: 1,
    muted: false,
    volumeEnvelope: [],
    fadeIn: 0,
    fadeOut: 0,
    transitionIn: { type: 'none', duration: 0.5 },
    ...partial,
  }
}
