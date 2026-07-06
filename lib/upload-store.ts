'use client'

import { create } from 'zustand'

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

export interface UploadMeta {
  title: string
  description?: string
  channelId?: string | null
  visibility: string
  pricingModel: string
  price?: number | null
  postType: string
  tags?: string | null
  stationId?: string | null
  clipStart?: number | null
  clipEnd?: number | null
}

interface UploadStore {
  status: UploadStatus
  progress: number
  fileName: string
  fileSize: number      // bytes — 0 when idle
  videoId: string | null
  error: string | null
  minimized: boolean

  startUpload: (file: File, meta: UploadMeta) => Promise<void>
  setDone: () => void
  dismiss: () => void
  setMinimized: (v: boolean) => void
}

// Module-level UpChunk ref — survives React navigation since it's not React state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _upchunkRef: any = null

export const useUploadStore = create<UploadStore>((set) => ({
  status: 'idle',
  progress: 0,
  fileName: '',
  fileSize: 0,
  videoId: null,
  error: null,
  minimized: false,

  startUpload: async (file, meta) => {
    set({ status: 'uploading', progress: 0, fileName: file.name, fileSize: file.size, error: null, videoId: null, minimized: false })

    try {
      const res = await fetch('/api/mux/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meta),
      })
      const json = await res.json()

      if (!res.ok) {
        set({ status: 'error', error: json.error ?? 'Failed to start upload' })
        return
      }

      set({ videoId: json.videoId })

      // Lazy-import UpChunk so this store can be loaded server-side without errors
      const UpChunk = await import('@mux/upchunk')
      const upload = UpChunk.createUpload({
        endpoint: json.uploadUrl,
        file,
        chunkSize: 512,           // 512 KB — smoother progress + avoids stalling on slow connections
        maxFileSize: 20 * 1024 * 1024, // 20 GiB client-side guard — covers 4h 4K HEVC (~15 GB)
      })

      _upchunkRef = upload

      upload.on('progress', (e: { detail: number }) => {
        set({ progress: Math.round(e.detail) })
      })

      upload.on('success', () => {
        set({ status: 'processing', progress: 100 })
        _upchunkRef = null
      })

      upload.on('error', (e: { detail?: { message?: string } }) => {
        set({
          status: 'error',
          error: e.detail?.message ?? 'Upload failed. Check your connection and try again.',
        })
        _upchunkRef = null
      })
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Something went wrong',
      })
      _upchunkRef = null
    }
  },

  setDone: () => set({ status: 'done' }),

  dismiss: () => {
    if (_upchunkRef?.abort) _upchunkRef.abort()
    _upchunkRef = null
    set({ status: 'idle', progress: 0, fileName: '', fileSize: 0, videoId: null, error: null, minimized: false })
  },

  setMinimized: (v) => set({ minimized: v }),
}))
