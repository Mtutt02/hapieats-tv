import { notFound } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import Image from 'next/image'
import Link from 'next/link'
import { formatViews } from '@/lib/utils'
import { Users, Video, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createServiceClient } from '@/lib/supabase/server'
import StationFollowButton from '@/components/stations/StationFollowButton'

interface PageProps {
  params: { slug: string }
}

export const revalidate = 60

async function getStation(slug: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('stations')
    .select('*')
    .eq('slug', slug)
    .single()
  return data
}

async function getStationVideos(stationId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('videos')
    .select(`
      id, title, thumbnail_url, view_count, duration, created_at,
      channel:channels(name, thumbnail_url)
    `)
    .eq('station_id', stationId)
    .eq('status', 'ready')
    .neq('is_clip', true)
    .order('created_at', { ascending: false })
    .limit(48)
  return data ?? []
}

export async function generateMetadata({ params }: PageProps) {
  const station = await getStation(params.slug)
  return { title: station ? `${station.name} Station` : 'Station' }
}

export default async function StationPage({ params }: PageProps) {
  const station = await getStation(params.slug)
  if (!station) notFound()

  const videos = await getStationVideos(station.id)

  return (
    <AppShell>
      <div className="pb-24 md:pb-8">
        {/* Banner */}
        <div className="relative w-full h-44 md:h-56 bg-muted">
          <Image
            src={station.cover_url ?? 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80'}
            alt={station.name}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        {/* Station header */}
        <div className="px-4 md:px-6 -mt-10 relative z-10 mb-6">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-card border-2 border-border flex items-center justify-center text-4xl shadow-xl">
              {station.icon}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-2xl font-bold leading-tight">{station.name}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {formatViews(station.follower_count)} followers
                </span>
                <span className="flex items-center gap-1">
                  <Video className="h-3.5 w-3.5" />
                  {videos.length > 0 ? videos.length : station.video_count} videos
                </span>
              </div>
            </div>
            <div className="flex gap-2 pb-1">
              <StationFollowButton stationId={station.id} followerCount={station.follower_count} />
              <Link href={`/studio/upload?stationId=${station.id}`}>
                <Button size="sm" variant="outline">Upload here</Button>
              </Link>
            </div>
          </div>
          {station.description && (
            <p className="text-muted-foreground text-sm mt-3 max-w-2xl">{station.description}</p>
          )}
        </div>

        {/* Videos */}
        <div className="px-4 md:px-6">
          <h2 className="text-base font-bold mb-4">Videos</h2>
          {videos.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <span className="text-5xl block mb-4">{station.icon}</span>
              <p className="font-medium mb-1">No videos yet in this station</p>
              <p className="text-sm mb-4">Be the first to upload here.</p>
              <Link href={`/studio/upload?stationId=${station.id}`}>
                <Button size="sm">Upload a video</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
              {videos.map((video: any) => (
                <Link key={video.id} href={`/watch/${video.id}`} className="group block">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-muted mb-3">
                    {video.thumbnail_url ? (
                      <Image
                        src={video.thumbnail_url}
                        alt={video.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-3xl">
                        🎬
                      </div>
                    )}
                    {video.duration && (
                      <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                        {video.duration}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
                      <AvatarImage src={video.channel?.thumbnail_url ?? ''} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">
                        {video.channel?.name?.charAt(0) ?? '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {video.title}
                      </h3>
                      <p className="text-muted-foreground text-xs mt-1">{video.channel?.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatViews(video.view_count ?? 0)} views ·{' '}
                        {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
