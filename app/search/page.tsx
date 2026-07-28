import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Search, Users } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search for food videos, recipes, and creators on HapiEats TV.',
}
import VideoGrid from '@/components/video/VideoGrid'
import { createClient } from '@/lib/supabase/server'
import type { Video, Channel } from '@/types'

interface SearchPageProps {
  searchParams: { q?: string; type?: string }
}

// ── Inline ChannelCard ──────────────────────────────────────────────────────

interface ChannelCardProps {
  channel: Channel
}

function ChannelCard({ channel }: ChannelCardProps) {
  const avatar =
    channel.thumbnail_url ??
    channel.creator?.avatar_url ??
    null

  const subscriberLabel =
    channel.subscriber_count >= 1000
      ? `${(channel.subscriber_count / 1000).toFixed(1)}K`
      : String(channel.subscriber_count)

  return (
    <Link
      href={`/channel/${channel.slug}`}
      className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors group"
    >
      <div className="relative h-16 w-16 rounded-full overflow-hidden bg-muted flex-shrink-0">
        {avatar ? (
          <Image
            src={avatar}
            alt={channel.name}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-primary/10">
            <span className="text-primary font-bold text-xl">
              {channel.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors truncate">
          {channel.name}
        </h3>
        {channel.description && (
          <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">
            {channel.description}
          </p>
        )}
        <div className="flex items-center gap-1 mt-1 text-muted-foreground text-xs">
          <Users className="h-3 w-3" />
          <span>{subscriberLabel} subscribers</span>
          {channel.video_count > 0 && (
            <>
              <span>·</span>
              <span>{channel.video_count} videos</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const q = searchParams.q?.trim() ?? ''
  const type = searchParams.type ?? 'all'

  let videos: Video[] = []
  let channels: Channel[] = []

  if (q.length >= 2) {
    const supabase = createClient()
    // Sanitize: strip every PostgREST filter metacharacter so the term can't
    // inject extra filters into the .or() string.
    const safeQ = q.replace(/[,().*:%\\_]/g, ' ').slice(0, 80)

    if (type === 'videos' || type === 'all') {
      const { data } = await supabase
        .from('videos')
        .select(
          'id, title, description, thumbnail_url, mux_playback_id, view_count, created_at, channel:channels(id, name, slug), creator:profiles(id, username, display_name, avatar_url)'
        )
        .or(`title.ilike.%${safeQ}%,description.ilike.%${safeQ}%`)
        .eq('status', 'ready')
        .eq('visibility', 'public')
        .neq('is_clip', true)
        .limit(20)

      videos = (data as unknown as Video[]) ?? []
    }

    if (type === 'channels' || type === 'all') {
      const { data } = await supabase
        .from('channels')
        .select(
          'id, name, slug, description, thumbnail_url, subscriber_count, video_count, creator:profiles(id, username, display_name, avatar_url)'
        )
        .or(`name.ilike.%${safeQ}%,description.ilike.%${safeQ}%`)
        .limit(10)

      channels = (data as unknown as Channel[]) ?? []
    }
  }

  const tabs = [
    { label: 'All', value: 'all' },
    { label: 'Videos', value: 'videos' },
    { label: 'Channels', value: 'channels' },
  ]

  const hasResults = videos.length > 0 || channels.length > 0

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Heading */}
        {q ? (
          <h1 className="text-2xl font-bold mb-6">
            Results for{' '}
            <span className="text-primary">&ldquo;{q}&rdquo;</span>
          </h1>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
            <Search className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg">Enter a search term above</p>
            <p className="text-sm mt-1">Search for food videos, recipes, and creators</p>
          </div>
        )}

        {q && (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-8">
              {tabs.map((tab) => {
                const isActive = type === tab.value
                return (
                  <Link
                    key={tab.value}
                    href={`/search?q=${encodeURIComponent(q)}&type=${tab.value}`}
                    className={[
                      'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                    ].join(' ')}
                  >
                    {tab.label}
                  </Link>
                )
              })}
            </div>

            {/* Videos section */}
            {type !== 'channels' && videos.length > 0 && (
              <section className="mb-10">
                <h2 className="text-lg font-semibold mb-4">Videos</h2>
                <VideoGrid videos={videos} />
              </section>
            )}

            {/* Channels section */}
            {type !== 'videos' && channels.length > 0 && (
              <section className="mb-10">
                <h2 className="text-lg font-semibold mb-4">Channels</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {channels.map((channel) => (
                    <ChannelCard key={channel.id} channel={channel} />
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {!hasResults && (
              <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
                <Search className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">
                  No results for &ldquo;{q}&rdquo;
                </p>
                <p className="text-sm mt-1">Try different keywords or browse categories</p>
              </div>
            )}
          </>
        )}
      </main>
    </AppShell>
  )
}
