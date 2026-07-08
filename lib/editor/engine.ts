'use client'

// ============================================================
// HapiEats TV Studio — Compositing / Playback Engine
// Draws the project to a canvas at any time T with layer
// compositing, keyframed transforms, filters, transitions,
// text animation, and a WebAudio mixing graph with envelopes.
// ============================================================

import {
  EditorProject, Track, Clip, MediaAsset, ASPECT_SIZES, projectDuration,
} from './types'
import { animatedValue, filterCss, gainAt } from './interpolate'

interface MediaEntry {
  asset: MediaAsset
  video?: HTMLVideoElement
  image?: HTMLImageElement
  audio?: HTMLAudioElement
  gain?: GainNode
  ready: boolean
}

type SegmenterLike = {
  segmentForVideo: (video: HTMLVideoElement, ts: number) => { confidenceMasks?: Array<{ getAsFloat32Array: () => Float32Array; close?: () => void }>; close?: () => void }
}

export class EditorEngine {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  audioCtx: AudioContext
  masterGain: GainNode
  streamDest: MediaStreamAudioDestinationNode
  private pool = new Map<string, MediaEntry>()
  private rafId = 0
  private playStartCtxTime = 0
  private playStartProjectTime = 0
  private playing = false
  private scratch: HTMLCanvasElement
  private scratchCtx: CanvasRenderingContext2D
  private maskCanvas: HTMLCanvasElement
  private maskCtx: CanvasRenderingContext2D
  private segmenter: SegmenterLike | null = null
  private segmenterLoading = false
  onTick: ((t: number) => void) | null = null
  onEnded: (() => void) | null = null
  getProject: () => EditorProject

  constructor(canvas: HTMLCanvasElement, getProject: () => EditorProject) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })!
    this.getProject = getProject
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
    this.audioCtx = new AC()
    this.masterGain = this.audioCtx.createGain()
    this.streamDest = this.audioCtx.createMediaStreamDestination()
    this.masterGain.connect(this.audioCtx.destination)
    this.masterGain.connect(this.streamDest)
    this.scratch = document.createElement('canvas')
    this.scratchCtx = this.scratch.getContext('2d')!
    this.maskCanvas = document.createElement('canvas')
    this.maskCtx = this.maskCanvas.getContext('2d')!
  }

  /** Route master audio to speakers or keep silent (export). */
  setMonitor(on: boolean) {
    try { this.masterGain.disconnect(this.audioCtx.destination) } catch {}
    if (on) this.masterGain.connect(this.audioCtx.destination)
  }

  // ---------------- media pool ----------------

  async ensureAsset(asset: MediaAsset): Promise<MediaEntry> {
    let entry = this.pool.get(asset.id)
    if (entry) { entry.asset = asset; return entry }
    entry = { asset, ready: false }
    this.pool.set(asset.id, entry)

    const src = asset.url || asset.remoteUrl || ''
    if (asset.kind === 'video') {
      const v = document.createElement('video')
      v.crossOrigin = 'anonymous'
      v.preload = 'auto'
      v.playsInline = true
      v.muted = false
      v.src = src
      entry.video = v
      const srcNode = this.audioCtx.createMediaElementSource(v)
      const g = this.audioCtx.createGain()
      g.gain.value = 0
      srcNode.connect(g).connect(this.masterGain)
      entry.gain = g
      await new Promise<void>((res) => {
        v.onloadedmetadata = () => res()
        v.onerror = () => res()
      })
    } else if (asset.kind === 'image') {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = src
      entry.image = img
      await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res() })
    } else {
      const a = new Audio()
      a.crossOrigin = 'anonymous'
      a.preload = 'auto'
      a.src = src
      entry.audio = a
      const srcNode = this.audioCtx.createMediaElementSource(a)
      const g = this.audioCtx.createGain()
      g.gain.value = 0
      srcNode.connect(g).connect(this.masterGain)
      entry.gain = g
      await new Promise<void>((res) => {
        a.onloadedmetadata = () => res()
        a.onerror = () => res()
      })
    }
    entry.ready = true
    return entry
  }

  async preload(): Promise<void> {
    const p = this.getProject()
    await Promise.all(p.assets.map(a => this.ensureAsset(a)))
  }

  // ---------------- background removal (MediaPipe) ----------------

  async loadSegmenter(): Promise<boolean> {
    if (this.segmenter) return true
    if (this.segmenterLoading) return false
    this.segmenterLoading = true
    try {
      const visionUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14'
      const mod: any = await import(/* webpackIgnore: true */ `${visionUrl}/vision_bundle.mjs`)
      const fileset = await mod.FilesetResolver.forVisionTasks(`${visionUrl}/wasm`)
      this.segmenter = await mod.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        outputConfidenceMasks: true,
      })
      return true
    } catch (e) {
      console.warn('Segmenter load failed', e)
      return false
    } finally {
      this.segmenterLoading = false
    }
  }

  private applySegmentation(video: HTMLVideoElement, w: number, h: number): HTMLCanvasElement | null {
    if (!this.segmenter) return null
    try {
      const result = this.segmenter.segmentForVideo(video, performance.now())
      const mask = result.confidenceMasks?.[0]
      if (!mask) return null
      const data = mask.getAsFloat32Array()
      const mw = video.videoWidth, mh = video.videoHeight
      this.maskCanvas.width = mw
      this.maskCanvas.height = mh
      const imgData = this.maskCtx.createImageData(mw, mh)
      for (let i = 0; i < data.length; i++) {
        imgData.data[i * 4 + 3] = Math.round(data[i] * 255)
      }
      this.maskCtx.putImageData(imgData, 0, 0)
      // composite: video masked by person confidence
      const out = document.createElement('canvas')
      out.width = mw; out.height = mh
      const octx = out.getContext('2d')!
      octx.drawImage(video, 0, 0)
      octx.globalCompositeOperation = 'destination-in'
      octx.drawImage(this.maskCanvas, 0, 0)
      mask.close?.()
      return out
    } catch {
      return null
    }
  }

  // ---------------- rendering ----------------

  /** Draw the composite frame for project time T. */
  drawFrame(T: number) {
    const p = this.getProject()
    const { w, h } = ASPECT_SIZES[p.aspect]
    if (this.canvas.width !== w) this.canvas.width = w
    if (this.canvas.height !== h) this.canvas.height = h
    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.filter = 'none'
    ctx.globalAlpha = 1
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)

    // video/image tracks render in order (later tracks on top = PiP layers)
    for (const track of p.tracks) {
      if (track.hidden) continue
      if (track.kind === 'video') {
        for (const clip of track.clips) {
          if (T < clip.start || T >= clip.start + clip.duration) continue
          this.drawVisualClip(clip, T, w, h)
        }
      }
    }
    // text tracks always on top
    for (const track of p.tracks) {
      if (track.hidden || track.kind !== 'text') continue
      for (const clip of track.clips) {
        if (T < clip.start || T >= clip.start + clip.duration) continue
        this.drawTextClip(clip, T, w, h)
      }
    }
  }

  private drawVisualClip(clip: Clip, T: number, w: number, h: number) {
    const entry = clip.assetId ? this.pool.get(clip.assetId) : undefined
    const local = T - clip.start
    let source: CanvasImageSource | null = null
    let sw = 0, sh = 0

    if (entry?.video) {
      const v = entry.video
      sw = v.videoWidth; sh = v.videoHeight
      if (clip.removeBackground && this.segmenter) {
        const seg = this.applySegmentation(v, sw, sh)
        if (seg) { source = seg } else source = v
      } else source = v
    } else if (entry?.image) {
      source = entry.image
      sw = entry.image.naturalWidth; sh = entry.image.naturalHeight
    }
    if (!source || !sw || !sh) return

    const ctx = this.ctx
    const x = animatedValue(clip, 'x', local)
    const y = animatedValue(clip, 'y', local)
    const scale = animatedValue(clip, 'scale', local)
    const rotate = animatedValue(clip, 'rotate', local)
    let opacity = animatedValue(clip, 'opacity', local)

    // transition-in
    const tr = clip.transitionIn
    let txOffset = 0, tyOffset = 0, trScale = 1, trBlur = 0
    if (tr && tr.type !== 'none' && local < tr.duration) {
      const k = Math.min(1, local / (tr.duration || 1e-6))
      switch (tr.type) {
        case 'fade': opacity *= k; break
        case 'slide-left': txOffset = (1 - k) * w; break
        case 'slide-right': txOffset = -(1 - k) * w; break
        case 'slide-up': tyOffset = (1 - k) * h; break
        case 'zoom': trScale = 0.6 + 0.4 * k; opacity *= k; break
        case 'blur': trBlur = (1 - k) * 18; opacity *= Math.min(1, k * 1.5); break
        case 'wipe': /* handled with clip region below */ break
      }
    }

    const fit = Math.min(w / sw, h / sh) * scale * trScale
    const dw = sw * fit, dh = sh * fit
    const cx = w / 2 + (x / 100) * w + txOffset
    const cy = h / 2 + (y / 100) * h + tyOffset

    ctx.save()
    if (tr?.type === 'wipe' && local < tr.duration) {
      const k = Math.min(1, local / (tr.duration || 1e-6))
      ctx.beginPath()
      ctx.rect(0, 0, w * k, h)
      ctx.clip()
    }
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity))
    const f = filterCss(clip.filters)
    ctx.filter = trBlur > 0 ? `${f === 'none' ? '' : f} blur(${trBlur}px)`.trim() : f
    ctx.translate(cx, cy)
    if (rotate) ctx.rotate((rotate * Math.PI) / 180)
    ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()
  }

  private drawTextClip(clip: Clip, T: number, w: number, h: number) {
    if (!clip.text) return
    const local = T - clip.start
    const style = clip.textStyle
    const ctx = this.ctx
    const x = animatedValue(clip, 'x', local)
    const y = animatedValue(clip, 'y', local)
    const scale = animatedValue(clip, 'scale', local)
    const rotate = animatedValue(clip, 'rotate', local)
    let opacity = animatedValue(clip, 'opacity', local)

    let popScale = 1, slideY = 0
    let visibleChars = Infinity
    const anim = style?.animation || 'none'
    if (anim === 'pop') {
      const k = Math.min(1, local / 0.35)
      popScale = 0.5 + 0.5 * (k < 0.8 ? k / 0.8 * 1.1 : 1.1 - (k - 0.8) / 0.2 * 0.1)
      opacity *= Math.min(1, k * 2)
    } else if (anim === 'slide-up') {
      const k = Math.min(1, local / 0.4)
      slideY = (1 - k) * 60
      opacity *= k
    } else if (anim === 'typewriter') {
      visibleChars = Math.floor((local / 0.05))
    } else if (anim === 'karaoke') {
      visibleChars = Math.floor((local / Math.max(0.01, clip.duration)) * (clip.text.length + 4))
    }

    const isSticker = clip.kind === 'sticker'
    const fontSize = (style?.fontSize || 72) * scale * popScale
    const cx = w / 2 + (x / 100) * w
    const cy = h / 2 + (y / 100) * h + slideY

    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity))
    ctx.translate(cx, cy)
    if (rotate) ctx.rotate((rotate * Math.PI) / 180)
    ctx.textAlign = style?.align || 'center'
    ctx.textBaseline = 'middle'
    const weight = style?.bold === false ? '' : 'bold '
    const italic = style?.italic ? 'italic ' : ''
    ctx.font = `${italic}${weight}${fontSize}px ${style?.fontFamily || 'Inter, system-ui, sans-serif'}`

    const lines = clip.text.split('\n')
    const lineHeight = fontSize * 1.2
    const totalH = lines.length * lineHeight
    let charBudget = visibleChars

    lines.forEach((line, i) => {
      const shown = charBudget === Infinity ? line : line.slice(0, Math.max(0, charBudget))
      if (charBudget !== Infinity) charBudget -= line.length
      const ly = -totalH / 2 + lineHeight * (i + 0.5)
      if (!shown) return
      if (style?.background) {
        const m = ctx.measureText(shown)
        const pad = fontSize * 0.25
        ctx.fillStyle = style.background
        const bx = style.align === 'left' ? 0 - pad : style.align === 'right' ? -m.width - pad : -m.width / 2 - pad
        ctx.beginPath()
        // @ts-ignore roundRect widely supported
        ctx.roundRect ? ctx.roundRect(bx, ly - lineHeight / 2, m.width + pad * 2, lineHeight, fontSize * 0.15) : ctx.rect(bx, ly - lineHeight / 2, m.width + pad * 2, lineHeight)
        ctx.fill()
      }
      if (!isSticker && style?.outline !== false) {
        ctx.lineWidth = Math.max(2, fontSize / 14)
        ctx.strokeStyle = 'rgba(0,0,0,0.75)'
        ctx.strokeText(shown, 0, ly)
      }
      ctx.fillStyle = style?.color || '#fff'
      ctx.fillText(shown, 0, ly)
    })
    ctx.restore()
  }

  // ---------------- audio + playback sync ----------------

  /** Update all media elements for time T. play=true keeps them rolling. */
  private syncMedia(T: number, play: boolean) {
    const p = this.getProject()
    for (const track of p.tracks) {
      const trackAudible = !track.muted && !track.hidden
      for (const clip of track.clips) {
        if (!clip.assetId) continue
        const entry = this.pool.get(clip.assetId)
        if (!entry) continue
        const el = entry.video || entry.audio
        if (!el) continue
        const active = T >= clip.start && T < clip.start + clip.duration
        const local = T - clip.start
        if (active) {
          const srcTime = clip.in + local * clip.speed
          const drift = Math.abs(el.currentTime - srcTime)
          el.playbackRate = Math.max(0.0625, Math.min(16, clip.speed))
          if (drift > 0.18 || !play) {
            try { el.currentTime = srcTime } catch {}
          }
          if (entry.gain) {
            const g = trackAudible && track.kind !== 'text' ? gainAt(clip, local) : 0
            entry.gain.gain.setTargetAtTime(g, this.audioCtx.currentTime, 0.03)
          }
          if (play && el.paused) { el.play().catch(() => {}) }
          if (!play && !el.paused) el.pause()
        } else {
          if (!el.paused) el.pause()
          if (entry.gain) entry.gain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.02)
        }
      }
    }
  }

  seek(T: number) {
    this.syncMedia(T, false)
    this.drawFrame(T)
  }

  play(fromT: number) {
    if (this.playing) return
    this.playing = true
    this.audioCtx.resume().catch(() => {})
    this.playStartCtxTime = this.audioCtx.currentTime
    this.playStartProjectTime = fromT
    const loop = () => {
      if (!this.playing) return
      const T = this.playStartProjectTime + (this.audioCtx.currentTime - this.playStartCtxTime)
      const dur = projectDuration(this.getProject())
      if (T >= dur) {
        this.pause()
        this.onTick?.(dur)
        this.onEnded?.()
        return
      }
      this.syncMedia(T, true)
      this.drawFrame(T)
      this.onTick?.(T)
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  pause() {
    this.playing = false
    cancelAnimationFrame(this.rafId)
    this.syncMedia(this.playStartProjectTime, false)
    const p = this.getProject()
    for (const track of p.tracks) for (const clip of track.clips) {
      if (!clip.assetId) continue
      const e = this.pool.get(clip.assetId)
      const el = e?.video || e?.audio
      if (el && !el.paused) el.pause()
    }
  }

  get isPlaying() { return this.playing }

  destroy() {
    this.pause()
    this.pool.forEach(e => {
      e.video?.pause()
      e.audio?.pause()
    })
    this.pool.clear()
    this.audioCtx.close().catch(() => {})
  }
}
