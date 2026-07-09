'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { type Clip, type ClipsFeedResponse, clipThumbnail } from '@/lib/clips/types'

function formatClipViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

interface ClipsRailProps {
  /** feed to pull from (default trending) */
  feed?: 'trending' | 'foryou'
  /** skip the first N clips — lets multiple shelves on one page show different clips */
  skip?: number
  title?: string
  emoji?: string
}

export default function ClipsRail({ feed = 'trending', skip = 0, title = 'Trending Clips', emoji = '🎬' }: ClipsRailProps) {
  const [clips, setClips] = useState<Clip[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/clips?feed=${feed}&limit=${12 + skip}`)
      .then((res) => {
        if (!res.ok) throw new Error(`clips fetch failed: ${res.status}`)
        return res.json() as Promise<ClipsFeedResponse>
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data.clips)) setClips(data.clips.slice(skip, skip + 12))
      })
      .catch(() => {
        /* rail stays hidden on error */
      })
    return () => { cancelled = true }
  }, [feed, skip])

  if (clips.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="flex items-center gap-2 text-sm sm:text-base font-bold">
          <span className="text-lg leading-none">{emoji}</span>
          {title}
        </h2>
        <Link
          href="/clips"
          className="text-xs text-primary hover:underline font-medium"
        >
          See all →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1">
        {clips.map((clip) => (
          <Link
            key={clip.id}
            href={`/clips/${clip.id}`}
            className="group relative flex-shrink-0 w-32 sm:w-40 aspect-[9/16] rounded-xl overflow-hidden bg-muted snap-start"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={clipThumbnail(clip.mux_playback_id)}
              alt={clip.title}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-2">
              <p className="text-white text-[11px] font-semibold leading-tight line-clamp-1">
                @{clip.creator.username}
              </p>
              <p className="text-white/70 text-[10px]">
                {formatClipViews(clip.view_count)} views
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
