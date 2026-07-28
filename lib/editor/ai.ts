'use client'

// ============================================================
// HapiEats TV Studio — AI Toolkit (premium)
// - Smart Trim: real silence detection via Web Audio analysis
// - Auto Captions: Mux generated subtitles (server route) for
//   library/uploaded assets, parsed into timed cues
// - Background Removal: MediaPipe segmentation (engine-side)
// ============================================================

import type { CaptionCue } from './types'

export interface SilenceRange {
  start: number
  end: number
}

/**
 * Analyze an audio/video file and return silent ranges.
 * threshold: RMS below this counts as silence (0..1)
 * minGap: minimum silence length in seconds to report
 */
export async function detectSilence(
  fileOrUrl: File | string,
  { threshold = 0.015, minGap = 0.6, pad = 0.12 } = {},
): Promise<{ duration: number; silences: SilenceRange[] }> {
  const buf = typeof fileOrUrl === 'string'
    ? await (await fetch(fileOrUrl)).arrayBuffer()
    : await fileOrUrl.arrayBuffer()

  const AC = (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext) as typeof OfflineAudioContext
  // decode via a throwaway realtime context (decodeAudioData needs one)
  const tmp = new (window.AudioContext || (window as any).webkitAudioContext)()
  let audio: AudioBuffer
  try {
    audio = await tmp.decodeAudioData(buf.slice(0))
  } finally {
    tmp.close().catch(() => {})
  }
  void AC

  const sr = audio.sampleRate
  const data = audio.getChannelData(0)
  const win = Math.floor(sr * 0.05) // 50ms windows
  const rms: number[] = []
  for (let i = 0; i < data.length; i += win) {
    let sum = 0
    const end = Math.min(i + win, data.length)
    for (let j = i; j < end; j++) sum += data[j] * data[j]
    rms.push(Math.sqrt(sum / (end - i)))
  }

  const silences: SilenceRange[] = []
  let runStart = -1
  for (let i = 0; i < rms.length; i++) {
    const silent = rms[i] < threshold
    const t = (i * win) / sr
    if (silent && runStart < 0) runStart = t
    if ((!silent || i === rms.length - 1) && runStart >= 0) {
      const end = silent ? audio.duration : t
      if (end - runStart >= minGap) {
        silences.push({
          start: Math.max(0, runStart + pad),
          end: Math.max(0, end - pad),
        })
      }
      runStart = -1
    }
  }
  return { duration: audio.duration, silences: silences.filter(s => s.end > s.start + 0.1) }
}

/** Invert silences into keep-segments for a clip of given duration. */
export function keepSegments(duration: number, silences: SilenceRange[]): SilenceRange[] {
  const keeps: SilenceRange[] = []
  let cursor = 0
  for (const s of silences) {
    if (s.start > cursor + 0.05) keeps.push({ start: cursor, end: s.start })
    cursor = Math.max(cursor, s.end)
  }
  if (cursor < duration - 0.05) keeps.push({ start: cursor, end: duration })
  return keeps
}

// ---------------- captions ----------------

/**
 * Request auto-generated captions for a Mux asset (library videos or
 * published studio exports). Returns queued status; poll fetchCaptionCues.
 */
export async function requestCaptions(muxAssetId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/editor/captions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId: muxAssetId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { ok: false, error: err.error || 'Caption request failed' }
  }
  return { ok: true }
}

/** Fetch generated caption cues for an asset (null while still processing). */
export async function fetchCaptionCues(muxAssetId: string): Promise<CaptionCue[] | null> {
  const res = await fetch(`/api/editor/captions?assetId=${encodeURIComponent(muxAssetId)}`)
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== 'ready' || !data.cues) return null
  return data.cues as CaptionCue[]
}

/** Parse WebVTT into cues (client fallback). */
export function parseVtt(vtt: string): CaptionCue[] {
  const cues: CaptionCue[] = []
  const blocks = vtt.replace(/\r/g, '').split('\n\n')
  const ts = (s: string) => {
    const m = s.trim().match(/(?:(\d+):)?(\d+):(\d+)\.(\d+)/)
    if (!m) return 0
    return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000
  }
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean)
    const timeLineIdx = lines.findIndex(l => l.includes('-->'))
    if (timeLineIdx < 0) continue
    const [a, b] = lines[timeLineIdx].split('-->')
    const text = lines.slice(timeLineIdx + 1).join('\n').trim()
    if (!text) continue
    cues.push({ start: ts(a), end: ts(b), text })
  }
  return cues
}
