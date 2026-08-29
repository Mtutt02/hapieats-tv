import { createClient, createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import HomeClient from '@/components/home/HomeClient'
import type { Video } from '@/types'
import { SAMPLE_VIDEOS, FOOD_CATEGORIES } from '@/lib/sample-data'
import Script from 'next/script'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = createServiceClient()
  const authClient = createClient()

  const { data: { user } } = await authClient.auth.getUser()

  const [{ data: dbVideos }, { data: followedRows }] = await Promise.all([
    supabase
      .from('videos')
      .select(`
        *,
        channel:channels(id, name, slug, thumbnail_url),
        creator:profiles(id, username, display_name, avatar_url)
      `)
      .eq('status', 'ready')
      .eq('visibility', 'public')
      .neq('is_clip', true)
      .neq('post_type', 'channel')
      .order('published_at', { ascending: false })
      .limit(24),

    // Fetch which stations the logged-in user follows (empty array if not logged in)
    user
      ? supabase
          .from('station_followers')
          .select('station_id')
          .eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
  ])

  const hasRealContent = (dbVideos?.length ?? 0) > 0
  const followedStationIds = (followedRows ?? []).map((r: { station_id: string }) => r.station_id)

  // Build video gallery schema from real + sample content.
  // Video (snake_case, from the DB) and SampleVideo (camelCase, static) do not
  // share field names, so normalize both into one shape before emitting JSON-LD.
  interface GalleryItem {
    name: string
    description: string
    thumbnailUrl?: string
    uploadDate?: string
    contentUrl?: string
    duration?: string
  }

  // schema.org wants an ISO-8601 duration; the DB stores whole seconds.
  const isoDuration = (seconds: number | null | undefined) =>
    seconds && seconds > 0 ? `PT${Math.floor(seconds / 60)}M${seconds % 60}S` : undefined

  const realItems: GalleryItem[] = ((dbVideos as Video[]) ?? []).map((v) => ({
    name: v.title || 'Food Video',
    description: v.description || `Watch ${v.title || 'a food video'} on HapiEats TV`,
    thumbnailUrl: v.thumbnail_url ?? undefined,
    uploadDate: v.published_at ?? v.created_at ?? undefined,
    // Only real rows have a watch page; sample content would 404.
    contentUrl: `https://hapieatstv.com/watch/${v.id}`,
    duration: isoDuration(v.duration),
  }))

  const sampleItems: GalleryItem[] = SAMPLE_VIDEOS.map((v) => ({
    name: v.title || 'Food Video',
    description: `Watch ${v.title || 'a food video'} on HapiEats TV`,
    thumbnailUrl: v.thumbnailUrl,
    uploadDate: v.publishedAt,
  }))

  const videoGallerySchema = {
    '@context': 'https://schema.org',
    '@type': 'VideoGallery',
    name: "HapiEats TV — Food Videos",
    description: 'Watch food creators cook, bake, grill, and explore cuisines from around the world.',
    url: 'https://hapieatstv.com',
    video: [...realItems, ...sampleItems].slice(0, 20).map((item) => ({
      '@type': 'VideoObject',
      ...item,
    })),
  }

  return (
    <AppShell>
      <Script
        id="video-gallery-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoGallerySchema) }}
      />
      <HomeClient
        dbVideos={(dbVideos as Video[]) ?? []}
        sampleVideos={SAMPLE_VIDEOS}
        hasRealContent={hasRealContent}
        categories={FOOD_CATEGORIES}
        followedStationIds={followedStationIds}
      />
    </AppShell>
  )
}
