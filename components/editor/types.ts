export interface Overlay {
  id: string
  type: 'text' | 'emoji'
  content: string
  x: number  // 0-100 (percent)
  y: number  // 0-100
  fontSize?: number
  color?: string
  size?: number  // for emojis
  startTime: number
  endTime: number
}

export interface MusicTrack {
  id: string
  name: string
  genre: string
  duration: string
  url?: string
}

export interface EditorOutput {
  clipStart: number
  clipEnd: number
  overlays: Overlay[]
  musicTrack: string | null
  voiceoverBlob: Blob | null
  filters: FilterSettings
  /** duration of the source video in seconds — lets consumers detect a real trim */
  sourceDuration?: number
}

// ---- NEW TYPES ----

export interface FilterSettings {
  brightness: number // -100 to 100
  contrast: number // -100 to 100
  saturation: number // -100 to 100
  warmth: number // -100 to 100
  blur: number // 0 to 20
  preset: string | null // 'none', 'vintage', 'noir', 'cinematic', 'warm', 'cool', 'dramatic'
}

export const DEFAULT_FILTERS: FilterSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  blur: 0,
  preset: null,
}

export interface TimelineClip {
  id: string
  type: 'video' | 'text' | 'music' | 'voice' | 'sticker' | 'overlay'
  label: string
  startTime: number
  endTime: number
  data?: any
}

export interface TimelineTrack {
  id: string
  label: string
  type: TimelineClip['type']
  icon: string // emoji icon
  clips: TimelineClip[]
  color: string // track color
}

export interface VideoClip {
  id: string
  file: File | null
  url: string
  startTime: number
  endTime: number
}
