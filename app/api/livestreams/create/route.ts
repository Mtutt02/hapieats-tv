import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { video } from '@/lib/mux'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Gate: only Creator Pro subscribers (or admins) can go live
  const { data: profile } = await supabase
    .from('profiles')
    .select('platform_subscription_status, role')
    .eq('id', user.id)
    .single()

  const isPro = profile?.platform_subscription_status === 'active'
  const isAdmin = ['admin', 'superadmin'].includes(profile?.role ?? '')

  if (!isPro && !isAdmin) {
    return NextResponse.json({
      error: 'Creator Pro subscription required to go live.',
      upgrade_required: true,
    }, { status: 403 })
  }

  const muxId = process.env.MUX_TOKEN_ID ?? ''
  if (!muxId || muxId.startsWith('your-') || muxId.length < 10) {
    return NextResponse.json({
      error: 'Mux credentials are not configured. Add MUX_TOKEN_ID and MUX_TOKEN_SECRET to your Vercel environment variables to enable live streaming.',
      setup: true,
    }, { status: 503 })
  }

  const body = await req.json()
  const { title, description, channelId } = body

  if (!title || !channelId) {
    return NextResponse.json({ error: 'title and channelId are required' }, { status: 400 })
  }

  // Verify user owns the channel
  const { data: channel } = await supabase
    .from('channels')
    .select('id')
    .eq('id', channelId)
    .eq('creator_id', user.id)
    .single()

  if (!channel) {
    return NextResponse.json({ error: 'Channel not found or not owned by user' }, { status: 403 })
  }

  // Create live stream on Mux
  const muxStream = await video.liveStreams.create({
    playback_policy: ['public'],
    new_asset_settings: { playback_policy: ['public'] },
    latency_mode: 'reduced',
  })

  const muxLiveStreamId = muxStream.id
  const streamKey = muxStream.stream_key
  const muxPlaybackId = muxStream.playback_ids?.[0]?.id ?? null

  // Insert into live_streams
  const { data: liveStream, error } = await supabase
    .from('live_streams')
    .insert({
      channel_id: channelId,
      creator_id: user.id,
      title,
      description: description ?? null,
      mux_live_stream_id: muxLiveStreamId,
      stream_key: streamKey,
      mux_playback_id: muxPlaybackId,
      status: 'idle',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return fields the client (GoLiveStudio) destructures directly
  return NextResponse.json({
    id: liveStream.id,
    stream_key: liveStream.stream_key,
    mux_playback_id: liveStream.mux_playback_id,
    title: liveStream.title,
  }, { status: 201 })
}
