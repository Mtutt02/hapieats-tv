import VideoCard from './VideoCard'
import type { Video } from '@/types'
import { PlayCircle } from 'lucide-react'

interface VideoGridProps {
  videos: Video[]
  emptyMessage?: string
}

export default function VideoGrid({ videos, emptyMessage = 'No videos yet.' }: VideoGridProps) {
  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <PlayCircle className="h-12 w-12 mb-3 opacity-30" />
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  )
}
