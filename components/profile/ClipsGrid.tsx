import Link from 'next/link'
import Image from 'next/image'
import { Play } from 'lucide-react'
import { formatViews } from '@/lib/utils'
import { clipThumbnail } from '@/lib/clips/types'

export interface ProfileClip {
  id: string
  title: string | null
  mux_playback_id: string | null
  view_count: number | null
}

interface ClipsGridProps {
  clips: ProfileClip[]
}

export default function ClipsGrid({ clips }: ClipsGridProps) {
  if (clips.length === 0) {
    return <p className="text-muted-foreground text-sm">No clips yet</p>
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {clips.map(clip => (
        <Link
          key={clip.id}
          href={`/clips/${clip.id}`}
          className="group relative aspect-[9/16] overflow-hidden rounded-xl border bg-black"
        >
          {clip.mux_playback_id ? (
            <Image
              src={clipThumbnail(clip.mux_playback_id)}
              alt={clip.title ?? 'Clip'}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-contain transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Play className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <span className="flex items-center gap-1 text-xs font-medium text-white">
              <Play className="h-3.5 w-3.5 fill-white" />
              {formatViews(clip.view_count ?? 0)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
