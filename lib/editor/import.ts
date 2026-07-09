'use client'

// Shared media-import helpers for the Studio editor.

import { MediaAsset, Clip, defaultClip, uid, EditorProject } from './types'
import { saveAssetBlob } from './persist'
import { useEditor } from './store'

export async function probeMediaFile(file: File): Promise<{ kind: MediaAsset['kind']; duration: number; width?: number; height?: number }> {
  const url = URL.createObjectURL(file)
  if (file.type.startsWith('image/')) {
    const img = new Image()
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('Unsupported image')); img.src = url })
    return { kind: 'image', duration: 5, width: img.naturalWidth, height: img.naturalHeight }
  }
  const isAudio = file.type.startsWith('audio/')
  const el = document.createElement(isAudio ? 'audio' : 'video') as HTMLVideoElement
  el.preload = 'metadata'
  await new Promise<void>((res, rej) => { el.onloadedmetadata = () => res(); el.onerror = () => rej(new Error('Unsupported media file')); el.src = url })
  return {
    kind: isAudio ? 'audio' : 'video',
    duration: el.duration || 5,
    width: el.videoWidth || undefined,
    height: el.videoHeight || undefined,
  }
}

/** Create a MediaAsset from a file, persist its blob, register it in the store. */
export async function importFileAsAsset(file: File): Promise<MediaAsset> {
  const meta = await probeMediaFile(file)
  const asset: MediaAsset = {
    id: uid(),
    kind: meta.kind,
    name: file.name,
    url: URL.createObjectURL(file),
    duration: meta.duration,
    width: meta.width,
    height: meta.height,
  }
  await saveAssetBlob(asset.id, file)
  useEditor.getState().addAsset(asset)
  return asset
}

/** Place a clip on the first free track of the right kind at the given time (defaults to playhead). */
export function placeClipOnTimeline(clip: Clip, kind: 'video' | 'audio' | 'text', at?: number) {
  const s = useEditor.getState()
  clip.start = at ?? s.currentTime
  const fits = (clips: Clip[]) => !clips.some(c => clip.start < c.start + c.duration && clip.start + clip.duration > c.start)
  let target = s.project.tracks.find(t => t.kind === kind && !t.locked && fits(t.clips))
  if (!target) target = s.addTrack(kind)
  s.addClip(target.id, clip)
  s.select(clip.id, target.id)
}

/** Import files and lay them on the timeline back-to-back starting at `at` (or the playhead). */
export async function importFilesToTimeline(files: FileList | File[], at?: number): Promise<number> {
  const s = useEditor.getState()
  let cursor = at ?? s.currentTime
  let added = 0
  for (const file of Array.from(files)) {
    try {
      const asset = await importFileAsAsset(file)
      const kind = asset.kind === 'audio' ? 'audio' : 'video'
      const clip = defaultClip(asset.kind === 'image' ? 'image' : kind, {
        label: asset.name,
        assetId: asset.id,
        duration: asset.kind === 'image' ? 5 : asset.duration,
      })
      placeClipOnTimeline(clip, kind, cursor)
      cursor += clip.duration
      added++
    } catch { /* skip unsupported file */ }
  }
  return added
}

/** Read ?project=<id> from the current URL (client only). */
export function projectIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('project')
}

export type { EditorProject }
