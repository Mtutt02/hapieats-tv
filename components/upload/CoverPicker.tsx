'use client'

// ============================================================
// Cover Picker — pick a clean 16:9 thumbnail for a video.
// Grabs 6 frames from the file, OR upload a custom image.
// Every option is COMPOSED onto a 1280×720 canvas (frame
// centered over a blurred fill) so the stored cover is always
// a crisp 16:9 image — the click-driver that fills the card.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageIcon, Upload, Loader2, Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const OUT_W = 1280
const OUT_H = 720

interface Props {
  /** first video file in the upload — frames are grabbed from it */
  file: File | null
  /** notify parent with the composed cover (JPEG data URL) or null to use default */
  onCoverChange: (dataUrl: string | null) => void
}

/** Draw a source (video frame or image) onto a 1280×720 canvas with a blurred fill backdrop. */
function compose16x9(source: CanvasImageSource, sw: number, sh: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = OUT_W
  canvas.height = OUT_H
  const ctx = canvas.getContext('2d')!

  // 1) blurred cover-fill backdrop (fills the whole frame, zoomed, blurred)
  const coverScale = Math.max(OUT_W / sw, OUT_H / sh)
  const cw = sw * coverScale, ch = sh * coverScale
  ctx.filter = 'blur(28px) brightness(0.7)'
  ctx.drawImage(source, (OUT_W - cw) / 2, (OUT_H - ch) / 2, cw, ch)
  ctx.filter = 'none'

  // 2) full frame centered (contain) — nothing cropped
  const fitScale = Math.min(OUT_W / sw, OUT_H / sh)
  const fw = sw * fitScale, fh = sh * fitScale
  ctx.drawImage(source, (OUT_W - fw) / 2, (OUT_H - fh) / 2, fw, fh)

  return canvas.toDataURL('image/jpeg', 0.85)
}

export default function CoverPicker({ file, onCoverChange }: Props) {
  const [frames, setFrames] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [custom, setCustom] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Grab 6 evenly-spaced frames from the video and compose each to 16:9
  useEffect(() => {
    if (!file || !file.type.startsWith('video/')) { setFrames([]); return }
    let cancelled = false
    setBusy(true)
    setFrames([])
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.src = url
    video.muted = true
    video.preload = 'auto'

    const run = async () => {
      await new Promise<void>((res, rej) => {
        video.onloadedmetadata = () => res()
        video.onerror = () => rej(new Error('metadata'))
      })
      const dur = video.duration || 0
      const points = [0.1, 0.28, 0.46, 0.64, 0.82, 0.95]
      const out: string[] = []
      for (const p of points) {
        if (cancelled) break
        video.currentTime = Math.min(dur * p, Math.max(0, dur - 0.1))
        await new Promise<void>(res => { video.onseeked = () => res() })
        try {
          out.push(compose16x9(video, video.videoWidth, video.videoHeight))
        } catch { /* skip frame */ }
      }
      if (!cancelled) {
        setFrames(out)
        if (out[0] && !custom) { setSelected(out[0]); onCoverChange(out[0]) }
      }
    }
    run().catch(() => {}).finally(() => { if (!cancelled) setBusy(false); URL.revokeObjectURL(url) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  const pickFrame = useCallback((dataUrl: string) => {
    setCustom(null)
    setSelected(dataUrl)
    onCoverChange(dataUrl)
  }, [onCoverChange])

  const uploadCustom = useCallback(async (f: File) => {
    if (!f.type.startsWith('image/')) return
    const url = URL.createObjectURL(f)
    const img = new Image()
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('img')); img.src = url })
    const composed = compose16x9(img, img.naturalWidth, img.naturalHeight)
    URL.revokeObjectURL(url)
    setCustom(composed)
    setSelected(composed)
    onCoverChange(composed)
  }, [onCoverChange])

  if (!file) return null

  const useAuto = () => { setCustom(null); setSelected(null); onCoverChange(null) }

  return (
    <div className="rounded-xl border border-zinc-800 p-3">
      <div className="mb-2 flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-white">Cover thumbnail</p>
        <span className="ml-auto text-[10px] text-zinc-500">A great cover gets more clicks</span>
      </div>

      {/* selected preview */}
      <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-lg bg-black">
        {selected ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selected} alt="Selected cover" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center text-[11px] text-zinc-500">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Auto cover (first clear frame)'}
          </div>
        )}
      </div>

      {/* frame strip */}
      {busy && frames.length === 0 ? (
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Grabbing frames…
        </div>
      ) : frames.length > 0 ? (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {frames.map((f, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pickFrame(f)}
              className={cn(
                'relative aspect-video overflow-hidden rounded-md border-2 transition-all',
                selected === f ? 'border-primary' : 'border-transparent hover:border-zinc-600'
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f} alt={`Frame ${i + 1}`} className="h-full w-full object-cover" />
              {selected === f && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                  <Check className="h-2.5 w-2.5 text-white" />
                </span>
              )}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-[11px] text-zinc-300 hover:border-primary/50"
        >
          <Upload className="h-3.5 w-3.5" /> Upload custom cover
        </button>
        {custom && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <Sparkles className="h-3 w-3" /> Custom cover set
          </span>
        )}
        {selected && (
          <button type="button" onClick={useAuto} className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-300">
            Use default
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          hidden
          accept="image/*"
          onChange={e => e.target.files?.[0] && uploadCustom(e.target.files[0])}
        />
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
        Covers are saved at 1280×720 (16:9) with a soft backdrop so they look clean everywhere — feed, search, and shares.
      </p>
    </div>
  )
}
