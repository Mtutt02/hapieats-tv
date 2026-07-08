import type { Clip, AnimatableProp, Keyframe, VolumePoint } from './types'

const EASE: Record<string, (t: number) => number> = {
  linear: t => t,
  easeIn: t => t * t,
  easeOut: t => t * (2 - t),
  easeInOut: t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
}

/** Value of an animatable prop at clip-local time (seconds). */
export function animatedValue(clip: Clip, prop: AnimatableProp, localT: number): number {
  const base = clip.transform[prop]
  const kfs = clip.keyframes[prop]
  if (!kfs || kfs.length === 0) return base
  const sorted = kfs
  if (localT <= sorted[0].t) return sorted[0].v
  if (localT >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1].v
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1]
    if (localT >= a.t && localT <= b.t) {
      const span = b.t - a.t || 1e-6
      const raw = (localT - a.t) / span
      const eased = (EASE[b.ease] || EASE.linear)(raw)
      return a.v + (b.v - a.v) * eased
    }
  }
  return base
}

/** Insert or update a keyframe, keeping the list sorted. */
export function upsertKeyframe(kfs: Keyframe[] | undefined, kf: Keyframe): Keyframe[] {
  const list = (kfs || []).filter(k => Math.abs(k.t - kf.t) > 0.033)
  list.push(kf)
  list.sort((a, b) => a.t - b.t)
  return list
}

/** Gain at clip-local time combining base volume, envelope, and fades. */
export function gainAt(clip: Clip, localT: number): number {
  if (clip.muted) return 0
  let g = clip.volume
  const env = clip.volumeEnvelope
  if (env.length > 0) {
    const sorted = env
    if (localT <= sorted[0].t) g *= sorted[0].v
    else if (localT >= sorted[sorted.length - 1].t) g *= sorted[sorted.length - 1].v
    else {
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i], b = sorted[i + 1]
        if (localT >= a.t && localT <= b.t) {
          g *= a.v + (b.v - a.v) * ((localT - a.t) / (b.t - a.t || 1e-6))
          break
        }
      }
    }
  }
  if (clip.fadeIn > 0 && localT < clip.fadeIn) g *= Math.max(0, localT / clip.fadeIn)
  const untilEnd = clip.duration - localT
  if (clip.fadeOut > 0 && untilEnd < clip.fadeOut) g *= Math.max(0, untilEnd / clip.fadeOut)
  return Math.max(0, Math.min(2, g))
}

/** CSS filter string for a clip's filter settings. */
export function filterCss(f: Clip['filters']): string {
  const parts: string[] = []
  const presets: Record<string, string> = {
    vintage: 'sepia(0.4) brightness(1.1) contrast(0.9) saturate(0.8)',
    noir: 'grayscale(1) contrast(1.3) brightness(0.9)',
    cinematic: 'sepia(0.15) contrast(1.2) saturate(0.7)',
    warm: 'sepia(0.2) saturate(1.2) brightness(1.05)',
    cool: 'hue-rotate(200deg) saturate(0.9) brightness(0.95)',
    dramatic: 'contrast(1.5) brightness(0.85) saturate(1.3)',
    golden: 'sepia(0.35) saturate(1.35) brightness(1.08) contrast(1.05)',
    fresh: 'saturate(1.4) brightness(1.06) contrast(1.02)',
  }
  if (f.preset && presets[f.preset]) parts.push(presets[f.preset])
  if (f.brightness !== 0) parts.push(`brightness(${1 + f.brightness / 100})`)
  if (f.contrast !== 0) parts.push(`contrast(${1 + f.contrast / 100})`)
  if (f.saturation !== 0) parts.push(`saturate(${1 + f.saturation / 100})`)
  if (f.warmth > 0) parts.push(`sepia(${f.warmth / 200})`)
  else if (f.warmth < 0) parts.push(`hue-rotate(${f.warmth * 2}deg)`)
  if (f.blur > 0) parts.push(`blur(${f.blur}px)`)
  return parts.join(' ') || 'none'
}
