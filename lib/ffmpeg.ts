import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { Overlay, FilterSettings, VideoClip } from '@/components/editor/types'

let ffmpeg: FFmpeg | null = null

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg
  ffmpeg = new FFmpeg()
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })
  return ffmpeg
}

export async function renderEditedVideo(
  originalFile: File,
  clips: VideoClip[],
  overlays: Overlay[],
  filters: FilterSettings,
  musicBlob?: Blob | null,
  voiceBlob?: Blob | null
): Promise<Blob> {
  const ff = await getFFmpeg()

  // Write original file to virtual filesystem
  const inputData = await fetchFile(originalFile)
  await ff.writeFile('input.mp4', inputData)

  // Build ffmpeg filter chain
  const filterParts: string[] = []

  // 1. Trim (if clip specified)
  const mainClip = clips[0]
  let inputOptions = ''
  if (mainClip) {
    const start = mainClip.startTime
    const end = mainClip.endTime
    if (start > 0) inputOptions += `-ss ${start} `
    if (end > start) inputOptions += `-to ${end} `
  }

  // 2. Apply color filters
  const videoFilters: string[] = []
  if (filters.brightness !== 0) {
    videoFilters.push(`eq=brightness=${(filters.brightness / 100).toFixed(2)}`)
  }
  if (filters.contrast !== 0) {
    videoFilters.push(`eq=contrast=${(1 + filters.contrast / 100).toFixed(2)}`)
  }
  if (filters.saturation !== 0) {
    videoFilters.push(`eq=saturation=${(1 + filters.saturation / 100).toFixed(2)}`)
  }

  // Handle presets
  if (filters.preset === 'vintage') {
    videoFilters.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131')
  } else if (filters.preset === 'noir') {
    videoFilters.push('hue=s=0')
    videoFilters.push('eq=contrast=1.3:brightness=-0.1')
  } else if (filters.preset === 'cinematic') {
    videoFilters.push('eq=contrast=1.2:saturation=0.7')
    videoFilters.push('curves=0/0 0.1/0.05 1/1')
  } else if (filters.preset === 'warm') {
    videoFilters.push('colorbalance=rs=0.1:gs=-0.05:bs=-0.1')
  } else if (filters.preset === 'cool') {
    videoFilters.push('colorbalance=rs=-0.1:gs=0.05:bs=0.1')
  } else if (filters.preset === 'dramatic') {
    videoFilters.push('eq=contrast=1.5:brightness=-0.15:saturation=1.3')
  }

  if (filters.blur > 0) {
    videoFilters.push(`boxblur=${(filters.blur / 5).toFixed(1)}`)
  }

  const filterStr = videoFilters.length > 0 ? `-vf "${videoFilters.join(',')}"` : ''

  // 3. Mix audio (original + music + voice)
  const audioInputs: string[] = ['-i', 'input.mp4']
  let audioMixFilter = '[0:a]'

  if (musicBlob) {
    const musicData = await fetchFile(musicBlob)
    await ff.writeFile('music.mp3', musicData)
    audioInputs.push('-i', 'music.mp3')
    audioMixFilter = `[0:a]volume=0.7[orig];[1:a]volume=0.5[mus];[orig][mus]amix=inputs=2:duration=first`
  }

  if (voiceBlob) {
    const voiceData = await fetchFile(voiceBlob)
    await ff.writeFile('voice.webm', voiceData)
    audioInputs.push('-i', 'voice.webm')

    if (musicBlob) {
      audioMixFilter = `[0:a]volume=0.5[orig];[1:a]volume=0.4[mus];[2:a]volume=1.0[voice];[orig][mus][voice]amix=inputs=3:duration=first`
    } else {
      audioMixFilter = `[0:a]volume=0.6[orig];[1:a]volume=1.0[voice];[orig][voice]amix=inputs=2:duration=first`
    }
  }

  const hasAudioMix = musicBlob || voiceBlob

  // Build and run the ffmpeg command
  let command = `-i input.mp4`
  if (mainClip && mainClip.startTime > 0) {
    command = `-ss ${mainClip.startTime} -i input.mp4`
  }
  if (mainClip && mainClip.endTime > mainClip.startTime) {
    command = `-ss ${mainClip.startTime} -to ${mainClip.endTime} -i input.mp4`
  }

  const cmd = [
    ...(mainClip && mainClip.startTime > 0 ? ['-ss', String(mainClip.startTime)] : []),
    ...(mainClip && mainClip.endTime > mainClip.startTime ? ['-to', String(mainClip.endTime)] : []),
    '-i', 'input.mp4',
    ...(musicBlob ? ['-i', 'music.mp3'] : []),
    ...(voiceBlob ? ['-i', 'voice.webm'] : []),
    ...(filterStr ? filterStr.split(' ') : []),
    ...(hasAudioMix ? ['-filter_complex', audioMixFilter, '-ac', '2'] : []),
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '22',
    ...(hasAudioMix ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
    '-y',
    'output.mp4',
  ].filter(Boolean) as string[]

  await ff.exec(cmd)

  // Read output
  const data = await ff.readFile('output.mp4')
  const blob = new Blob([data], { type: 'video/mp4' })

  // Cleanup
  try {
    await ff.deleteFile('input.mp4')
    if (musicBlob) await ff.deleteFile('music.mp3')
    if (voiceBlob) await ff.deleteFile('voice.webm')
    await ff.deleteFile('output.mp4')
  } catch {
    // Best effort cleanup
  }

  return blob
}
