import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { playbackIdBelongsToUser } from '@/lib/mux-upload-guard'

/**
 * POST /api/mux/import
 * Create a video record from an existing Mux playback ID.
 * Bypasses the Mux upload API so it works even without MUX_TOKEN_ID configured.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      playbackId,
      title,
      description,
      channelId,
      visibility,
      pricingModel,
      price,
      postType,
      tags,
      stationId,
      duration,
    } = body

    if (!playbackId || !title) {
      return NextResponse.json({ error: 'playbackId and title are required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Monetization guard — only verified creators may set paid pricing
    if (pricingModel && pricingModel !== 'free') {
      const { data: prof } = await supabase.from('profiles').select('is_creator').eq('id', user.id).single()
      if (!prof?.is_creator) {
        return NextResponse.json({ error: 'Creator account required to set paid pricing' }, { status: 403 })
      }
    }

    // Verify user owns the channel before importing into it
    if (channelId) {
      const { data: channel } = await serviceClient
        .from('channels')
        .select('id')
        .eq('id', channelId)
        .eq('creator_id', user.id)
        .single()
      if (!channel) {
        return NextResponse.json({ error: 'Channel not found or not owned by you' }, { status: 403 })
      }
    }

    // Any public playback ID is guessable/shareable, so only accept one whose Mux asset was
    // created by this user's own direct upload (passthrough binding). Fails closed.
    if (!(await playbackIdBelongsToUser(playbackId, user.id))) {
      return NextResponse.json({ error: 'Playback ID not found' }, { status: 404 })
    }

    // A playback ID that is already on the platform belongs to whoever uploaded it.
    // Re-importing it would republish their video under this account.
    const { data: existingPlayback } = await serviceClient
      .from('videos')
      .select('id')
      .eq('mux_playback_id', playbackId)
      .maybeSingle()
    if (existingPlayback) {
      return NextResponse.json({ error: 'This video is already on HapiEats TV' }, { status: 409 })
    }

    const { data: videoRecord, error } = await serviceClient
      .from('videos')
      .insert({
        title,
        description: description ?? null,
        channel_id: channelId ?? null,
        creator_id: user.id,
        mux_playback_id: playbackId,
        status: 'ready',
        visibility: visibility ?? 'public',
        pricing_model: pricingModel ?? 'free',
        price: price ?? null,
        post_type: postType ?? (channelId ? 'channel' : 'general'),
        tags: tags ?? null,
        station_id: stationId ?? null,
        duration: duration ?? null,
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !videoRecord) {
      console.error('DB error:', error)
      return NextResponse.json({ error: 'Failed to create video record' }, { status: 500 })
    }

    return NextResponse.json({ videoId: videoRecord.id })
  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
