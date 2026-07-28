import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import { ListVideo, Play } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps { params: { seriesId: string } }

function thumb(v: any): string {
  if (v.thumbnail_url) return v.thumbnail_url
  if (v.mux_playback_id) return `https://image.mux.com/${v.mux_playback_id}/thumbnail.jpg?width=640&fit_mode=preserve&time=1`
  return ''
}

function fmtViews(n: number | null): string {
  const v = n ?? 0
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return String(v)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const service = createServiceClient()
  const { data: s } = await service.from('series').select('title, description').eq('id', params.seriesId).single()
  return {
    title: s?.title ? `${s.title} — Series` : 'Series',
    description: s?.description ?? 'A video series on HapiEats TV.',
  }
}

export default async function SeriesPage({ params }: PageProps) {
  const service = createServiceClient()
  const { data: series } = await service
    .from('series')
    .select('id, title, description, channel_id, is_public, video_count, channel:channels(name, slug)')
    .eq('id', params.seriesId)
    .single()

  if (!series || series.is_public === false) notFound()

  const { data: items } = await service
    .from('series_videos')
    .select('position, video:videos(id, title, thumbnail_url, mux_playback_id, duration, view_count, status, is_clip)')
    .eq('series_id', params.seriesId)
    .order('position', { ascending: true })

  const videos = (items ?? [])
    .map((r: any) => r.video)
    .filter((v: any) => v && v.status === 'ready' && !v.is_clip)

  const channel = (series as any).channel
  const first = videos[0]

  return (
    <AppShell>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <ListVideo className="h-4 w-4 text-primary" />
          <span>Series</span>
          {channel?.slug && (
            <>
              <span>·</span>
              <Link href={`/channel/${channel.slug}`} className="hover:text-primary">{channel.name}</Link>
            </>
          )}
        </div>
        <h1 className="text-2xl font-bold">{series.title}</h1>
        {series.description && <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{series.description}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{videos.length} video{videos.length === 1 ? '' : 's'}</p>

        {first && (
          <Link href={`/watch/${first.id}`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
            <Play className="h-4 w-4" /> Play all
          </Link>
        )}

        {videos.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">No videos in this series yet.</p>
        ) : (
          <ol className="mt-6 space-y-2">
            {videos.map((v: any, i: number) => (
              <li key={v.id}>
                <Link href={`/watch/${v.id}`} className="group flex gap-3 items-center rounded-xl p-2 hover:bg-accent/50">
                  <span className="w-6 text-center text-sm font-mono text-muted-foreground">{i + 1}</span>
                  <div className="relative w-40 aspect-video rounded-lg overflow-hidden bg-black flex-shrink-0">
                    {thumb(v) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb(v)} alt={v.title} className="absolute inset-0 h-full w-full object-contain" loading="lazy" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold line-clamp-2 group-hover:text-primary">{v.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtViews(v.view_count)} views</p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </main>
    </AppShell>
  )
}
