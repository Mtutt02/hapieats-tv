/**
 * Client-side video compositor.
 *
 * Mux direct uploads do not support server-side compositing (overlays,
 * filters, music, voiceover). This utility renders the final video with
 * all editor edits applied using Canvas + MediaRecorder, then returns
 * a Blob that can be uploaded instead of the raw file.
 *
 * Usage:
 *   const composedBlob = await composeFinalVideo(rawFile, editorOutput)
 *   uploadStore.startUpload(composedBlob, meta)
 */

import type { EditorOutput, Overlay, FilterSettings } from '@/components/editor/types'

interface ComposeOptions {
  onProgress?: (pct: number) => void
  fps?: number
  quality?: number // 0-1 for video bitrate
}

/**
 * Apply CSS-style filters to a canvas 2D context.
 * Mirrors the logic in VideoPreview.getFilterStyle().
 */
function applyFilters(ctx: CanvasRenderingContext2D, filters: FilterSettings): void {
  const parts: string[] = []

  if (filters.preset === 'vintage') {
    parts.push('sepia(0.4)', 'brightness(1.1)', 'contrast(0.9)', 'saturate(0.8)')
  } else if (filters.preset === 'noir') {
    parts.push('grayscale(1)', 'contrast(1.3)', 'brightness(0.9)')
  } else if (filters.preset === 'cinematic') {
    parts.push('sepia(0.15)', 'contrast(1.2)', 'saturate(0.7)')
  } else if (filters.preset === 'warm') {
    parts.push('sepia(0.2)', 'saturate(1.2)', 'brightness(1.05)')
  } else if (filters.preset === 'cool') {
    parts.push('hue-rotate(200deg)', 'saturate(0.9)', 'brightness(0.95)')
  } else if (filters.preset === 'dramatic') {
    parts.push('contrast(1.5)', 'brightness(0.85)', 'saturate(1.3)')
  } else if (filters.preset === 'golden') {
    parts.push('sepia(0.35)', 'saturate(1.35)', 'brightness(1.08)', 'contrast(1.05)')
  } else if (filters.preset === 'fresh') {
    parts.push('saturate(1.4)', 'brightness(1.06)', 'contrast(1.02)')
  }

  if (filters.brightness !== 0) parts.push(`brightness(${1 + filters.brightness / 100})`)
  if (filters.contrast !== 0) parts.push(`contrast(${1 + filters.contrast / 100})`)
  if (filters.saturation !== 0) parts.push(`saturate(${1 + filters.saturation / 100})`)
  if (filters.blur > 0) parts.push(`blur(${filters.blur}px)`)

  if (filters.warmth !== 0) {
    const warmth = filters.warmth > 0 ? `sepia(${filters.warmth / 200})` : `hue-rotate(${filters.warmth * 2}deg)`
    parts.push(warmth)
  }

  if (parts.length > 0) {
    ctx.filter = parts.join(' ')
  }
}

/**
 * Draw overlays (text + emoji) on the canvas at the given timestamp.
 */
function drawOverlays(
  ctx: CanvasRenderingContext2D,
  overlays: Overlay[],
  currentTime: number,
  canvasW: number,
  canvasH: number,
): void {
  const active = overlays.filter(o => currentTime >= o.startTime && currentTime <= o.endTime)

  for (const overlay of active) {
    const ox = (overlay.x / 100) * canvasW
    const oy = (overlay.y / 100) * canvasH

    ctx.save()

    if (overlay.type === 'text') {
      ctx.font = `bold ${overlay.fontSize || 40}px system-ui, sans-serif`
      ctx.fillStyle = overlay.color || '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.6)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1
      ctx.fillText(overlay.content, ox, oy)
    } else if (overlay.type === 'emoji') {
      const size = overlay.size || 48
      ctx.font = `${size}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(overlay.content, ox, oy)
    }

    ctx.restore()
  }
}

/**
 * Compose the final video by rendering each frame to canvas with
 * overlays, filters, and optional music/voiceover mixed in.
 *
 * Returns a Blob suitable for uploading via UpChunk.
 */
export async function composeFinalVideo(
  rawFile: File,
  output: EditorOutput,
  options: ComposeOptions = {},
): Promise<Blob> {
  const { onProgress, fps = 30, quality = 0.8 } = options

  // Create video element
  const video = document.createElement('video')
  video.muted = true // Don't play audio through speakers (we capture via AudioContext)
  video.playsInline = true
  video.src = URL.createObjectURL(rawFile)

  // Wait for metadata
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Failed to load video metadata'))
    video.load()
  })

  const duration = video.duration
  const videoW = video.videoWidth
  const videoH = video.videoHeight

  // Setup canvas
  const canvas = document.createElement('canvas')
  canvas.width = videoW
  canvas.height = videoH
  const ctx = canvas.getContext('2d', { alpha: false })!
  const offscreenCtx = document.createElement('canvas').getContext('2d', { alpha: true })!

  // Audio context for mixing music + voiceover
  const audioCtx = new AudioContext()
  const dest = audioCtx.createMediaStreamDestination()
  const gainNode = audioCtx.createGain()
  gainNode.gain.value = 1.0

  // Connect audio sources
  const audioSources: AudioNode[] = []

  // Source 1: Original video audio — captureStream may not be available in all browsers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videoEl = video as any
  const videoStream = videoEl.captureStream?.(fps) as MediaStream | undefined

  if (videoStream) {
    const audioTracks = videoStream.getAudioTracks()
    if (audioTracks.length > 0) {
      const vidSrc = audioCtx.createMediaStreamSource(new MediaStream([audioTracks[0]]))
      audioSources.push(vidSrc)
      vidSrc.connect(gainNode)
    }
  }

  // Source 2: Voiceover (if present)
  if (output.voiceoverBlob) {
    const voiceBuffer = await output.voiceoverBlob.arrayBuffer()
    const voiceAudio = await audioCtx.decodeAudioData(voiceBuffer)
    const voiceSrc = audioCtx.createBufferSource()
    voiceSrc.buffer = voiceAudio
    voiceSrc.connect(gainNode)
    voiceSrc.loop = false
    voiceSrc.start(0)
    audioSources.push(voiceSrc)
  }

  // Source 3: Music track (if selected — generated via Web Audio API)
  if (output.musicTrack) {
    try {
      const { generateTrackAudio, MUSIC_LIBRARY } = await import('@/components/editor/music-data')
      // Look up the FULL track (with its composition config) — passing a bare
      // id object would silently fall back to a placeholder tone.
      const fullTrack = MUSIC_LIBRARY.find(t => t.id === output.musicTrack)
        ?? { id: output.musicTrack, name: '', genre: '', duration: '' }
      const musicUrl = generateTrackAudio(fullTrack)
      const musicRes = await fetch(musicUrl)
      const musicBuf = await musicRes.arrayBuffer()
      const musicAudio = await audioCtx.decodeAudioData(musicBuf)
      const musicSrc = audioCtx.createBufferSource()
      musicSrc.buffer = musicAudio
      // Duplicate the music track to fill the video duration if needed
      const musicDur = musicAudio.duration
      if (musicDur < duration) {
        // We can't directly loop with offset; create a longer source
        const loopCount = Math.ceil(duration / musicDur)
        const totalSamples = musicAudio.length * loopCount
        const loopedBuf = audioCtx.createBuffer(
          musicAudio.numberOfChannels,
          totalSamples,
          musicAudio.sampleRate,
        )
        for (let ch = 0; ch < musicAudio.numberOfChannels; ch++) {
          const srcData = musicAudio.getChannelData(ch)
          const dstData = loopedBuf.getChannelData(ch)
          for (let i = 0; i < loopCount; i++) {
            const offset = i * musicAudio.length
            const copyLen = Math.min(srcData.length, totalSamples - offset)
            dstData.set(srcData.subarray(0, copyLen), offset)
          }
        }
        const loopedSrc = audioCtx.createBufferSource()
        loopedSrc.buffer = loopedBuf
        loopedSrc.connect(gainNode)
        loopedSrc.start(0)
        audioSources.push(loopedSrc)
      } else {
        musicSrc.connect(gainNode)
        musicSrc.start(0)
        audioSources.push(musicSrc)
      }
    } catch {
      // Music generation failed — continue without music
      console.warn('Music track could not be generated for composition')
    }
  }

  gainNode.connect(dest)

  // Setup MediaRecorder for the composited stream
  const canvasStream = canvas.captureStream(fps)

  // Combine canvas video + mixed audio
  const videoTrackComposite = canvasStream.getVideoTracks()[0]
  const mixedStream = new MediaStream([videoTrackComposite, ...dest.stream.getAudioTracks()])

  const mimeType = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
  ].find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm'

  const recorder = new MediaRecorder(mixedStream, {
    mimeType,
    videoBitsPerSecond: Math.round(quality * 5_000_000), // ~4 Mbps at quality 0.8
  })

  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const recordingDone = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      resolve(blob)
    }
    recorder.onerror = () => reject(new Error('MediaRecorder error during composition'))
  })

  // Start recording
  recorder.start(1000 / fps) // chunk every frame-ish

  // Seek to clip start
  video.currentTime = output.clipStart
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve()
  })

  video.play()

  // Frame-by-frame rendering loop
  const trimmedDuration = output.clipEnd - output.clipStart
  const totalFrames = Math.round(trimmedDuration * fps)
  const frameDuration = 1 / fps

  for (let frame = 0; frame < totalFrames; frame++) {
    const videoTime = output.clipStart + frame * frameDuration
    video.currentTime = videoTime

    // Wait for the frame to be available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vElem = video as any
    await new Promise<void>((resolve) => {
      if (typeof vElem.requestVideoFrameCallback === 'function') {
        vElem.requestVideoFrameCallback(() => resolve())
      } else {
        vElem.onseeked = () => resolve()
      }
    })

    // Draw video frame to canvas
    const scale = Math.min(canvas.width / videoW, canvas.height / videoH)
    const dx = (canvas.width - videoW * scale) / 2
    const dy = (canvas.height - videoH * scale) / 2

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(video, dx, dy, videoW * scale, videoH * scale)

    // Apply filters
    ctx.save()
    applyFilters(ctx, output.filters)

    // Redraw video with filters applied
    // (We draw the frame again with the filter applied on top)
    ctx.drawImage(video, dx, dy, videoW * scale, videoH * scale)
    ctx.filter = 'none'
    ctx.restore()

    // Draw overlays
    drawOverlays(ctx, output.overlays, videoTime, canvas.width, canvas.height)

    // Report progress
    if (onProgress) {
      onProgress(Math.round((frame / totalFrames) * 100))
    }

    // Allow UI to breathe every 10 frames
    if (frame % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  video.pause()
  recorder.stop()

  // Cleanup
  URL.revokeObjectURL(video.src)
  audioSources.forEach(src => {
    try { (src as AudioNode).disconnect() } catch {}
  })
  audioCtx.close()

  const result = await recordingDone
  onProgress?.(100)
  return result
}
