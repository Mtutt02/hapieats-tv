import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import TVBrowser, { TVChannel } from '@/components/tv/TVBrowser'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'HapiEats TV',
  description: 'Flip through food channels — live streams, on-demand recipes, and more.',
}

// Fallback sample channels (fill in when no content is available for a slot)
const SAMPLE_CHANNELS: Omit<TVChannel, 'number'>[] = [
  {
    name: 'Japanese Kitchen',
    icon: '🍣',
    description: 'Ramen, sushi & izakaya classics',
    category: 'Japanese',
    videoUrl: 'https://videos.pexels.com/video-files/4253333/4253333-hd_1920_1080_25fps.mp4',
    currentTitle: 'Chef Plating Sushi — Live from the Kitchen',
  },
  {
    name: 'Street Food World',
    icon: '🌮',
    description: 'Street eats from every corner of the planet',
    category: 'Street Food',
    videoUrl: 'https://videos.pexels.com/video-files/854565/854565-hd_1920_1080_25fps.mp4',
    currentTitle: 'Tacos Al Pastor — Mexico City Style',
  },
  {
    name: 'BBQ & Smoke',
    icon: '🔥',
    description: 'Pitmasters and the craft of low-and-slow',
    category: 'BBQ',
    videoUrl: 'https://videos.pexels.com/video-files/14150484/14150484-hd_1920_1080_25fps.mp4',
    currentTitle: 'Texas Brisket — 14-Hour Smoke',
  },
  {
    name: 'Baking Lab',
    icon: '🥐',
    description: 'Bread, pastries, cakes — the science of baking',
    category: 'Baking',
    videoUrl: 'https://videos.pexels.com/video-files/6603824/6603824-hd_1920_1080_25fps.mp4',
    currentTitle: 'Croissant Dough — Laminated Layer by Layer',
  },
  {
    name: 'Italian Table',
    icon: '🍝',
    description: 'Pasta, pizza, risotto — authentic Italian',
    category: 'Italian',
    videoUrl: 'https://videos.pexels.com/video-files/3196175/3196175-hd_1920_1080_25fps.mp4',
    currentTitle: 'Creamy Carbonara — Chef\'s Plate',
  },
  {
    name: 'Plant-Based Kitchen',
    icon: '🌱',
    description: 'Vegan and vegetarian recipes that excite',
    category: 'Plant-Based',
    videoUrl: 'https://videos.pexels.com/video-files/4252800/4252800-hd_1920_1080_25fps.mp4',
    currentTitle: 'Plant-Based Prep — Zero Waste Kitchen',
  },
  {
    name: 'Dessert Lab',
    icon: '🍫',
    description: 'Chocolate, ice cream, tarts — everything sweet',
    category: 'Desserts',
    videoUrl: 'https://videos.pexels.com/video-files/4661944/4661944-hd_1920_1080_25fps.mp4',
    currentTitle: 'Chocolate Lava Cake — The Secret Revealed',
  },
  {
    name: 'Food Prep',
    icon: '🍽️',
    description: 'Techniques, tools, mise en place',
    category: 'Techniques',
    videoUrl: 'https://videos.pexels.com/video-files/1341925/1341925-hd_1920_1080_25fps.mp4',
    currentTitle: 'Mise en Place — Professional Kitchen Setup',
  },
]

export default async function TVPage() {
  const supabase = createServiceClient()

  // ── 1. Admin-curated TV lineup (fixed channel numbers) ───────────────────
  const { data: lineupRows } = await supabase
    .from('tv_lineup')
    .select(`
      channel_number, name, icon, description, category,
      mux_playback_id, video_url,
      channel:channel_id (
        id, name, slug,
        videos:videos ( title, mux_playback_id, status )
      )
    `)
    .eq('is_active', true)
    .order('channel_number', { ascending: true })

  // ── 2. Active live streams (always surface these) ────────────────────────
  const { data: liveStreams } = await supabase
    .from('live_streams')
    .select('id, title, mux_playback_id, channel:channels(name, slug, id)')
    .eq('status', 'active')
    .limit(10)

  // ── Build a map of live streams by channel_id for fast lookup ────────────
  const liveByChannelId = new Map<string, { title: string; mux_playback_id: string }>()
  for (const ls of liveStreams ?? []) {
    const chId = (ls.channel as { id: string } | null)?.id
    if (chId && ls.mux_playback_id) {
      liveByChannelId.set(chId, { title: ls.title, mux_playback_id: ls.mux_playback_id })
    }
  }

  // ── Build the curated channel list from lineup ───────────────────────────
  const usedNumbers = new Set<number>()
  const channels: TVChannel[] = []

  // Curated lineup slots
  for (const row of lineupRows ?? []) {
    usedNumbers.add(row.channel_number)

    const ch = row.channel as {
      id: string
      name: string
      videos: { title: string; mux_playback_id: string; status: string }[]
    } | null

    // Check if this channel has an active live stream
    const live = ch ? liveByChannelId.get(ch.id) : null

    let muxPlaybackId: string | undefined
    let videoUrl: string | undefined
    let currentTitle = row.name
    let isLive = false

    if (live) {
      // Live overrides everything
      muxPlaybackId = live.mux_playback_id
      currentTitle = live.title
      isLive = true
    } else if (row.mux_playback_id) {
      muxPlaybackId = row.mux_playback_id
    } else if (row.video_url) {
      videoUrl = row.video_url
    } else if (ch) {
      // Use the latest ready video from the linked HapiEats channel
      const readyVid = (ch.videos ?? []).find(v => v.status === 'ready')
      if (readyVid) {
        muxPlaybackId = readyVid.mux_playback_id
        currentTitle = readyVid.title
      }
    }

    channels.push({
      number: row.channel_number,
      name: row.name,
      icon: row.icon,
      description: row.description ?? '',
      category: row.category ?? 'General',
      currentTitle,
      muxPlaybackId,
      videoUrl,
      isLive,
    })
  }

  // ── Orphan live streams (not in any lineup slot) ─────────────────────────
  // Give them auto-numbers in the 90s so they're surfaceable
  let orphanNum = 90
  for (const ls of liveStreams ?? []) {
    const chId = (ls.channel as { id: string } | null)?.id
    const alreadyInLineup = chId && [...usedNumbers].some(n => {
      // Check if this channel_id is in lineup — we already handled it above
      return false
    })
    if (!alreadyInLineup && ls.mux_playback_id) {
      while (usedNumbers.has(orphanNum)) orphanNum++
      usedNumbers.add(orphanNum)
      channels.push({
        number: orphanNum,
        name: (ls.channel as { name: string } | null)?.name ?? 'Live Channel',
        icon: '📡',
        description: 'Live right now',
        category: 'LIVE',
        currentTitle: ls.title,
        muxPlaybackId: ls.mux_playback_id,
        isLive: true,
      })
      orphanNum++
    }
  }

  // ── Fill remaining slots with sample channels ────────────────────────────
  // Start sample channels at high numbers (100+) if lineup is populated,
  // otherwise start at 1 so there's always content to watch
  let fillNum = usedNumbers.size > 0 ? 100 : 1
  for (const sample of SAMPLE_CHANNELS) {
    while (usedNumbers.has(fillNum)) fillNum++
    usedNumbers.add(fillNum)
    channels.push({ ...sample, number: fillNum })
    fillNum++
  }

  // Sort final list by channel number
  channels.sort((a, b) => a.number - b.number)

  return (
    <AppShell fullWidth>
      <TVBrowser channels={channels} />
    </AppShell>
  )
}
