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

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'HapiEats TV',
    url: 'https://hapieatstv.com',
    logo: 'https://hapieatstv.com/icon',
    sameAs: [],
    description: 'Watch and support food creators on HapiEats TV. Free and premium food videos, live streams, and cooking classes.',
  }

  const webSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'HapiEats TV',
    url: 'https://hapieatstv.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: 'https://hapieatstv.com/search?q={search_term_string}' },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <AppShell>
      <Script
        id="org-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Script
        id="website-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
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
