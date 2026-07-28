'use client'

import MuxPlayer from '@mux/mux-player-react'
import Link from 'next/link'

interface Props {
  playbackId: string | null
  status: 'idle' | 'active' | 'ended'
  recordingAssetId?: string | null
}

export default function LivePlayerClient({ playbackId, status, recordingAssetId }: Props) {
  if (status === 'idle') {
    return (
      <div className="aspect-video flex items-center justify-center rounded-xl bg-muted text-muted-foreground text-center px-6">
        <div>
          <p className="text-lg font-semibold">Stream hasn't started yet</p>
          <p className="text-sm mt-1">Check back soon — the creator will be live shortly.</p>
        </div>
      </div>
    )
  }

  if (status === 'ended') {
    return (
      <div className="aspect-video flex items-center justify-center rounded-xl bg-muted text-muted-foreground text-center px-6">
        <div>
          <p className="text-lg font-semibold">This stream has ended</p>
          {recordingAssetId ? (
            <p className="text-sm mt-2">
              A recording will be available in the creator's channel shortly.
            </p>
          ) : (
            <p className="text-sm mt-1">No recording is available for this stream.</p>
          )}
        </div>
      </div>
    )
  }

  if (!playbackId) {
    return (
      <div className="aspect-video flex items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <p className="text-sm">Playback unavailable.</p>
      </div>
    )
  }

  return (
    <MuxPlayer
      playbackId={playbackId}
      streamType="live"
      autoPlay
      className="w-full rounded-xl overflow-hidden"
    />
  )
}
