'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { Eye, MoreVertical, Pencil, Trash2, Globe, Lock, EyeOff } from 'lucide-react'
import { formatViews, getVideoThumbnail } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import type { Video } from '@/types'

const VISIBILITY_ICONS = {
  public: Globe,
  private: Lock,
  unlisted: EyeOff,
}

const STATUS_COLORS: Record<string, string> = {
  ready: 'bg-green-100 text-green-700',
  processing: 'bg-yellow-100 text-yellow-700',
  uploading: 'bg-blue-100 text-blue-700',
  errored: 'bg-red-100 text-red-700',
}

interface VideoTableProps {
  videos: Video[]
}

export default function VideoTable({ videos: initial }: VideoTableProps) {
  const [videos, setVideos] = useState(initial)
  const supabase = createClient()

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video? This cannot be undone.')) return
    await supabase.from('videos').delete().eq('id', id)
    setVideos((prev) => prev.filter((v) => v.id !== id))
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
        <p>No videos yet.</p>
        <Link href="/studio/upload" className="text-primary font-medium text-sm mt-2 inline-block">
          Upload your first video →
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Video</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Status</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Visibility</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Views</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Uploaded</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {videos.map((video) => {
            const thumbnail = getVideoThumbnail(video.mux_playback_id, video.thumbnail_url)
            const VisibilityIcon = VISIBILITY_ICONS[video.visibility] ?? Globe
            return (
              <tr key={video.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative w-20 aspect-video rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <Image src={thumbnail} alt={video.title} fill className="object-cover" sizes="80px" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/watch/${video.id}`}
                        className="font-medium hover:text-primary transition-colors line-clamp-1"
                      >
                        {video.title}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {video.pricing_model === 'pay_per_view' ? `$${video.price}` : video.pricing_model}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[video.status] ?? ''}`}>
                    {video.status}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="flex items-center gap-1 text-muted-foreground capitalize">
                    <VisibilityIcon className="h-3.5 w-3.5" />
                    {video.visibility}
                  </span>
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell text-muted-foreground">
                  <span className="flex items-center justify-end gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {formatViews(video.view_count)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right hidden lg:table-cell text-muted-foreground text-xs">
                  {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
                </td>
                <td className="px-4 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/studio/videos/${video.id}/edit`} className="flex items-center gap-2 cursor-pointer">
                          <Pencil className="h-4 w-4" /> Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(video.id)}
                        className="text-destructive flex items-center gap-2 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
