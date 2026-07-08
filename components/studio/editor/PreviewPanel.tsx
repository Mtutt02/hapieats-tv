'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward, Maximize2 } from 'lucide-react'
import { useEditor } from '@/lib/editor/store'
import { EditorEngine } from '@/lib/editor/engine'
import { projectDuration } from '@/lib/editor/types'

/** Shared engine handle for export / AI panels. */
export const engineRef: { current: EditorEngine | null } = { current: null }

export function formatTime(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const f = Math.floor((t % 1) * 30)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${f.toString().padStart(2, '0')}`
}

export default function PreviewPanel() {
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const playing = useEditor(s => s.playing)
  const currentTime = useEditor(s => s.currentTime)
  const aspect = useEditor(s => s.project.aspect)
  const projectId = useEditor(s => s.project.id)
  const assetsLen = useEditor(s => s.project.assets.length)
  const updatedAt = useEditor(s => s.project.updatedAt)

  // engine lifecycle
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new EditorEngine(canvas, () => useEditor.getState().project)
    engineRef.current = engine
    engine.onTick = (t) => useEditor.setState({ currentTime: t })
    engine.onEnded = () => useEditor.setState({ playing: false })
    engine.preload().then(() => engine.seek(useEditor.getState().currentTime))
    return () => {
      engine.destroy()
      if (engineRef.current === engine) engineRef.current = null
    }
    // recreate only per project instance
  }, [projectId])

  // preload new assets as they're added
  useEffect(() => {
    engineRef.current?.preload().then(() => {
      const s = useEditor.getState()
      if (!s.playing) engineRef.current?.seek(s.currentTime)
    })
  }, [assetsLen])

  // play / pause
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    if (playing) engine.play(useEditor.getState().currentTime)
    else engine.pause()
  }, [playing])

  // redraw on scrub / edits while paused
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || engine.isPlaying) return
    engine.seek(currentTime)
  }, [currentTime, updatedAt, aspect])

  const togglePlay = useCallback(() => {
    const s = useEditor.getState()
    const dur = projectDuration(s.project)
    if (!s.playing && s.currentTime >= dur - 0.02) s.setTime(0)
    useEditor.setState({ playing: !s.playing })
  }, [])

  const skip = useCallback((delta: number) => {
    const s = useEditor.getState()
    useEditor.setState({ playing: false })
    s.setTime(s.currentTime + delta)
  }, [])

  const fullscreen = useCallback(() => {
    canvasHostRef.current?.requestFullscreen?.().catch(() => {})
  }, [])

  const duration = projectDuration(useEditor.getState().project)
  const vertical = aspect === '9:16'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={canvasHostRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/60 border border-zinc-800/80">
        <canvas
          ref={canvasRef}
          className={vertical ? 'h-full max-h-full w-auto max-w-full' : 'w-full max-w-full h-auto max-h-full'}
          onClick={togglePlay}
        />
        {!playing && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
            aria-label="Play"
          >
            <Play className="h-7 w-7 translate-x-0.5" />
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <span className="font-mono text-[11px] text-zinc-400 tabular-nums">{formatTime(currentTime)}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => skip(-5)} className="rounded-lg p-2 text-zinc-300 hover:bg-zinc-800" aria-label="Back 5s">
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={togglePlay}
            className="rounded-xl bg-white px-4 py-2 text-black hover:bg-zinc-200"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
          </button>
          <button onClick={() => skip(5)} className="rounded-lg p-2 text-zinc-300 hover:bg-zinc-800" aria-label="Forward 5s">
            <SkipForward className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-zinc-500 tabular-nums">{formatTime(duration)}</span>
          <button onClick={fullscreen} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800" aria-label="Fullscreen">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
