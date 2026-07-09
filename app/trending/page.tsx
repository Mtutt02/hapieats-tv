import type { Metadata } from 'next'
import AppShell from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/server'
import { SAMPLE_VIDEOS } from '@/lib/sample-data'
import Image from 'next/image'
import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import ClipsRail from '@/components/home/ClipsRail'

export const metadata: Metadata = {
  title: 'Trending',
  description: 'The most-watched food videos on HapiEats TV right now.',
}

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export default async function TrendingPage() {
  const supabase = createClient()
  const { data: dbVideos } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url, view_count, like_count, duration, created_at, channel:channels(name, slug), creator:profiles(username, display_name)')
    .eq('status', 'ready')
    .eq('visibility', 'public')
    .order('view_count', { ascending: false })
    .limit(24)

  const videos = (dbVideos && dbVideos.length > 0)
    ? dbVideos
    : SAMPLE_VIDEOS.sort((a, b) => b.viewCount - a.viewCount)

  const isReal = dbVideos && dbVideos.length > 0

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <TrendingUp className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Trending</h1>
            <p className="text-sm text-muted-foreground">Most-watched food content right now</p>
          </div>
        </div>

        {/* Rail renders null until clip data loads; empty:hidden removes the ghost margin */}
        <div className="mb-8 empty:hidden">
          <ClipsRail />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((v: any, i) => (
            <div key={v.id} className="relative">
              <span className="absolute top-2 left-2 z-10 bg-black/70 text-white text-xs font-bold px-2 py-0.5 rounded">
                #{i + 1}
              </span>
              {isReal ? (
                <Link href={`/watch/${v.id}`} className="block group">
                  <div className="aspect-video bg-muted rounded-xl overflow-hidden relative">
                    {v.thumbnail_url && (
                      <Image src={v.thumbnail_url} alt={v.title} fill className="object-cover group-hover:scale-105 transition-transform duration-200" />
                    )}
                  </div>
                  <div className="mt-2 px-1">
                    <div className="font-medium text-sm leading-snug line-clamp-2">{v.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{(v.channel as any)?.name}</div>
                    <div className="text-xs text-muted-foreground">{formatViews(v.view_count ?? 0)} views</div>
                  </div>
                </Link>
              ) : (
                <Link href={`/watch/${v.id}`} className="block group">
                  <div className="aspect-video bg-muted rounded-xl overflow-hidden relative">
                    <Image src={v.thumbnailUrl} alt={v.title} fill className="object-cover group-hover:scale-105 transition-transform duration-200" />
                  </div>
                  <div className="mt-2 px-1">
                    <div className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">{v.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{v.channelName}</div>
                    <div className="text-xs text-muted-foreground">{formatViews(v.viewCount ?? 0)} views</div>
                  </div>
                </Link>
              )}
            </div>
          ))}
        </div>
      </main>
    </AppShell>
  )
}
