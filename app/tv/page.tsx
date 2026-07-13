import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import TVBrowser, { TVChannel, TVPlaylistItem } from '@/components/tv/TVBrowser'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'HapiEats TV',
  description: 'Flip through food channels — live streams, on-demand recipes, and more.',
}

// ── Fixed station dial ────────────────────────────────────────────────────────
// Slug order defines channel numbers 1–8. Names/icons/descriptions come from
// the stations table (source of truth).
const STATION_DIAL: string[] = [
  'general',          // 1 — The Main Stage (also absorbs unassigned videos)
  'street-food',      // 2 — Street Eats
  'bbq',              // 3 — Fire and Smoke
  'baking',           // 4 — Rise and Bake
  'desserts',         // 5 — Sweet Spot
  'italian',          // 6 — Family Table
  'japanese-kitchen', // 7 — Wander and Taste
  'plant-based',      // 8 — Fresh and Fit
  'travel',           // 9 — Wanderlust
  'lifestyle',        // 10 — The Good Life
  'mukbang',          // 11 — Feast Mode
  'food-reviews',     // 12 — Taste Test
  'global-foods',     // 13 — Around the World
]

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

export default async function TVPage() {
  const supabase = createServiceClient()

  // ── 1. Stations (the 8 community channels), their programming, live now ──
  const [{ data: stationRows }, { data: videoRows }, { data: liveStreams }] = await Promise.all([
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

  const stations = (stationRows ?? []) as StationRow[]
  const videos = (videoRows ?? []) as VideoRow[]
  const stationBySlug = new Map(stations.map(s => [s.slug, s]))

  // ── 2. Group videos into per-station playlists (published_at ASC) ────────
  // Unassigned videos (station_id IS NULL) roll into The Main Stage (CH 01)
  // so channel 1 always has content.
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

  // ── 3. Build channels 1–8 from the station dial ──────────────────────────
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

  // ── 4. Active live streams — appended after the station dial (CH 90+) ────
  let liveNum = 90
  for (const ls of liveStreams ?? []) {
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
}
