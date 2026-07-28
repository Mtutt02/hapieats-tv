import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin(): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return !!profile && ['admin', 'superadmin'].includes(profile.role ?? '')
}

// Seed sample content with real-looking videos.
// GET  /api/admin/seed-content — returns status of existing content
// POST /api/admin/seed-content — inserts seed videos into the database

const SEED_VIDEOS = [
  {
    title: '🔥 Smash Burger with Wagyu Beef',
    description: 'The ultimate smash burger recipe using American Wagyu blend. Crispy edges, juicy center, perfect cheese melt.',
    mux_playback_id: 'bP6XRc6Nf502myJ7IxpwADy01n02bWiTZ7T00vQNuDS00s',
    duration: 424,
    thumbnail_url: 'https://image.mux.com/bP6XRc6Nf502myJ7IxpwADy01n02bWiTZ7T00vQNuDS00s/thumbnail.jpg?width=640&fit_mode=preserve&time=30',
    pricing_model: 'free',
    visibility: 'public',
    view_count: 54200,
  },
  {
    title: '🍣 Sushi Rice Master Class',
    description: 'Learn the art of perfect sushi rice from a Tokyo-trained chef. Vinegar ratio, folding technique, and temperature control.',
    mux_playback_id: '7q02i00O009a9RXHRLI00GfT0202I1V02j3dQqivw023QVkI',
    duration: 612,
    thumbnail_url: 'https://image.mux.com/7q02i00O009a9RXHRLI00GfT0202I1V02j3dQqivw023QVkI/thumbnail.jpg?width=640&fit_mode=preserve&time=45',
    pricing_model: 'free',
    visibility: 'public',
    view_count: 31700,
  },
  {
    title: '🌮 Mexico City Street Tacos',
    description: 'Al pastor style tacos with authentic marinade, grilled pineapple, and fresh salsa verde. A taste of CDMX at home.',
    mux_playback_id: 'Xh01R02U02W00Ck01o02Gu6V02O0233yXCqN01BB8gKtLf00',
    duration: 540,
    thumbnail_url: 'https://image.mux.com/Xh01R02U02W00Ck01o02Gu6V02O0233yXCqN01BB8gKtLf00/thumbnail.jpg?width=640&fit_mode=preserve&time=60',
    pricing_model: 'free',
    visibility: 'public',
    view_count: 92100,
  },
  {
    title: '🍝 Cacio e Pepe the Roman Way',
    description: 'Three ingredients. Perfect technique. The iconic Roman pasta dish that proves simplicity is the ultimate sophistication.',
    mux_playback_id: '00eH01aYWuI00fWGQJLbhC02WEzDejwP5I02PRIg5Wx100Q',
    duration: 380,
    thumbnail_url: 'https://image.mux.com/00eH01aYWuI00fWGQJLbhC02WEzDejwP5I02PRIg5Wx100Q/thumbnail.jpg?width=640&fit_mode=preserve&time=25',
    pricing_model: 'free',
    visibility: 'public',
    view_count: 61300,
  },
  {
    title: '🥐 Croissant Lamination Technique',
    description: 'Master the 27-layer lamination process for bakery-quality croissants. Butter block technique, folding, and proofing tips.',
    mux_playback_id: '6HC018a00zQhGU00V01a00pp1M02hJFC02q1FGB02IPx01m8',
    duration: 720,
    thumbnail_url: 'https://image.mux.com/6HC018a00zQhGU00V01a00pp1M02hJFC02q1FGB02IPx01m8/thumbnail.jpg?width=640&fit_mode=preserve&time=90',
    pricing_model: 'free',
    visibility: 'public',
    view_count: 37900,
  },
  {
    title: '🍕 Neapolitan Pizza in Home Oven',
    description: 'Authentic Neapolitan pizza using a regular home oven. Biga preferment, San Marzano tomatoes, fresh mozzarella technique.',
    mux_playback_id: 'RW36MAKL001Y024k2fP008601Rfk02l02Hc02WIaBbZxOIc',
    duration: 490,
    thumbnail_url: 'https://image.mux.com/RW36MAKL001Y024k2fP008601Rfk02l02Hc02WIaBbZxOIc/thumbnail.jpg?width=640&fit_mode=preserve&time=35',
    pricing_model: 'free',
    visibility: 'public',
    view_count: 79200,
  },
]

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = createServiceClient()
  const { data: existing } = await supabase
    .from('videos')
    .select('id, title, view_count')
    .order('created_at', { ascending: false })
    .limit(30)

  return NextResponse.json({
    count: existing?.length ?? 0,
    recent: existing?.slice(0, 10) ?? [],
  })
}

export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = createServiceClient()

  // Get or create the HapiEats Kitchen channel
  let channelId: string | null = null
  const { data: channels } = await supabase
    .from('channels')
    .select('id')
    .limit(1)

  if (channels && channels.length > 0) {
    channelId = channels[0].id
  } else {
    return NextResponse.json({ error: 'No channel exists. Upload a video first to create a channel.' }, { status: 400 })
  }

  // Get the channel's creator_id
  const { data: channel } = await supabase
    .from('channels')
    .select('id, creator_id, name')
    .eq('id', channelId)
    .single()

  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
  }

  const results = []
  for (const video of SEED_VIDEOS) {
    const { data: existing } = await supabase
      .from('videos')
      .select('id')
      .eq('mux_playback_id', video.mux_playback_id)
      .maybeSingle()

    if (existing) {
      results.push({ title: video.title, status: 'already exists', id: existing.id })
      continue
    }

    const { data: created, error } = await supabase
      .from('videos')
      .insert({
        channel_id: channel.id,
        creator_id: channel.creator_id,
        title: video.title,
        description: video.description,
        mux_playback_id: video.mux_playback_id,
        duration: video.duration,
        thumbnail_url: video.thumbnail_url,
        pricing_model: video.pricing_model,
        visibility: video.visibility,
        status: 'ready',
        view_count: video.view_count,
        published_at: new Date().toISOString(),
      })
      .select('id, title')
      .single()

    if (error) {
      results.push({ title: video.title, status: 'error', error: error.message })
    } else {
      results.push({ title: video.title, status: 'inserted', id: created.id })
    }
  }

  return NextResponse.json({ results, channel: channel.name })
}
