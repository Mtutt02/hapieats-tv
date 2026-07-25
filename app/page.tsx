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

  // Build video gallery schema from real + sample content
  const allVideos = [...((dbVideos as Video[]) ?? []), ...SAMPLE_VIDEOS].slice(0, 20)
  const videoGallerySchema = {
    '@context': 'https://schema.org',
    '@type': 'VideoGallery',
    name: "HapiEats TV — Food Videos",
    description: 'Watch food creators cook, bake, grill, and explore cuisines from around the world.',
    url: 'https://hapieatstv.com',
    video: allVideos.map(v => ({
      '@type': 'VideoObject',
      name: v.title || 'Food Video',
      description: v.description || `Watch ${v.title || 'a food video'} on HapiEats TV`,
      thumbnailUrl: v.thumbnail_url || v.thumbnail,
      uploadDate: v.published_at || v.created_at || new Date().toISOString().split('T')[0],
      contentUrl: v.video_url ? `https://hapieatstv.com/watch/${v.id}` : undefined,
      embedUrl: v.embed_url || undefined,
      duration: v.duration || undefined,
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
