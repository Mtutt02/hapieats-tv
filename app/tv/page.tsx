import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import TVBrowser, { TVChannel, TVPlaylistItem } from '@/components/tv/TVBrowser'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'HapiEats TV',
  description: 'Flip through food channels — live streams, on-demand recipes, and more.',
}

const STATION_DIAL: string[] = [
  'general', 'street-food', 'bbq', 'baking', 'desserts',
  'italian', 'japanese-kitchen', 'plant-based', 'travel',
  'lifestyle', 'mukbang', 'food-reviews', 'global-foods',
]

export default async function TVPage() {
  try {
    const supabase = createServiceClient()

    const results = await Promise.allSettled([
      supabase
        .from('stations')
        .select('id, slug, name, icon, description, theme')
        .in('slug', STATION_DIAL),
      supabase
        .from('videos')
        .select('title, mux_playback_id, duration, station_id')
        .eq('status', 'ready')
        .eq('visibility', 'public')
        .eq('is_clip', false)
        .not('mux_playback_id', 'is', null)
        .order('published_at', { ascending: true }),
      supabase
        .from('live_streams')
        .select('id, title, mux_playback_id, channel:channels(name, slug, id)')
        .eq('status', 'active')
        .limit(10),
    ])

    const stationRows = results[0].status === 'fulfilled' ? results[0].value.data : null
    const videoRows = results[1].status === 'fulfilled' ? results[1].value.data : null
    const liveStreamRows = results[2].status === 'fulfilled' ? results[2].value.data : null

    if (!stationRows && !videoRows && !liveStreamRows) {
      // All queries failed — render empty fallback
      return (
        <AppShell fullWidth>
          <TVBrowser channels={[]} />
        </AppShell>
      )
    }

    const stations = (stationRows ?? []) as StationRow[]
    const videos = (videoRows ?? []) as VideoRow[]
    const liveStreams = liveStreamRows ?? []
    const stationBySlug = new Map(stations.map(s => [s.slug, s]))

    const mainStageId = stationBySlug.get('general')?.id
    const playlists = new Map<string, TVPlaylistItem[]>()
    for (const v of videos) {
      if (!v.mux_playback_id) continue
      const key = v.station_id ?? mainStageId
      if (!key) continue
      const list = playlists.get(key) ?? []
      list.push({ title: v.title, muxPlaybackId: v.mux_playback_id, duration: v.duration ?? null })
      playlists.set(key, list)
    }

    const channels: TVChannel[] = []
    STATION_DIAL.forEach((slug, i) => {
      const st = stationBySlug.get(slug)
      if (!st) return
      const playlist = playlists.get(st.id) ?? []
      channels.push({
        number: i + 1,
        name: st.name,
        icon: st.icon ?? '📺',
        description: st.description ?? '',
        category: st.theme ?? 'Community',
        currentTitle: playlist[0]?.title ?? 'Off Air',
        playlist,
      })
    })

    let liveNum = 90
    for (const ls of liveStreams) {
      if (!ls.mux_playback_id) continue
      channels.push({
        number: liveNum++,
        name: (ls.channel as { name: string } | null)?.name ?? 'Live Channel',
        icon: '📡',
        description: 'Live right now',
        category: 'LIVE',
        currentTitle: ls.title,
        muxPlaybackId: ls.mux_playback_id,
        isLive: true,
      })
    }

    return (
      <AppShell fullWidth>
        <TVBrowser channels={channels} />
      </AppShell>
    )
  } catch (err) {
    console.error('TVPage error:', err)
    return (
      <AppShell fullWidth>
        <TVBrowser channels={[]} />
      </AppShell>
    )
  }
}

interface StationRow {
  id: string
  slug: string
  name: string
  icon: string | null
  description: string | null
  theme: string | null
}

interface VideoRow {
  title: string
  mux_playback_id: string | null
  duration: number | null
  station_id: string | null
}
