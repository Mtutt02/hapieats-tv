import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { video as muxVideo } from '@/lib/mux'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { title, description, channelId, visibility, pricingModel, price, postType, tags, stationId, clipStart, clipEnd } = body

    const muxId = process.env.MUX_TOKEN_ID ?? ''
    if (!muxId || muxId.startsWith('your-') || muxId.length < 10) {
      return NextResponse.json({
        error: 'Mux credentials are not configured. Use "Import Mux ID" tab instead, or add MUX_TOKEN_ID + MUX_TOKEN_SECRET to your Vercel environment variables.',
        setup: true,
      }, { status: 503 })
    }

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Monetization guard — only verified creators may set paid pricing
    if (pricingModel && pricingModel !== 'free') {
      const { data: prof } = await supabase.from('profiles').select('is_creator').eq('id', user.id).single()
      if (!prof?.is_creator) {
        return NextResponse.json({ error: 'Creator account required to set paid pricing' }, { status: 403 })
      }
    }

    // If channelId provided, verify it belongs to this creator
    if (channelId) {
      const { data: channel } = await serviceClient
        .from('channels')
        .select('id')
        .eq('id', channelId)
        .eq('creator_id', user.id)
        .single()

      if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Mux requires an explicit origin for direct uploads (not '*').
    // Fall back to the canonical domain if the env var isn't set.
    const corsOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://hapieatstv.com').replace(/\/$/, '')

    // Create Mux direct upload URL
    const upload = await muxVideo.uploads.create({
      cors_origin: corsOrigin,
      new_asset_settings: {
        playback_policy: ['public'],
        encoding_tier: 'smart',   // better quality/size ratio than 'baseline'
      },
    })

    // Create video record in Supabase
    const { data: videoRecord, error } = await serviceClient
      .from('videos')
      .insert({
        title,
        description: description ?? null,
        channel_id: channelId ?? null,
        creator_id: user.id,
        mux_upload_id: upload.id,
        status: 'uploading',
        visibility: visibility ?? 'public',
        pricing_model: pricingModel ?? 'free',
        price: price ?? null,
        post_type: postType ?? (channelId ? 'channel' : 'general'),
        tags: tags ?? null,
        station_id: stationId ?? null,
        clip_start: clipStart ?? null,
        clip_end: clipEnd ?? null,
      })
      .select('id')
      .single()

    if (error || !videoRecord) {
      console.error('DB error:', error)
      return NextResponse.json({ error: 'Failed to create video record' }, { status: 500 })
    }

    return NextResponse.json({
      uploadUrl: upload.url,
      uploadId: upload.id,
      videoId: videoRecord.id,
    })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number; statusCode?: number }
    console.error('Mux upload error:', err)
    const status = e?.status ?? e?.statusCode ?? 500
    const message = e?.message ?? 'Internal server error'
    return NextResponse.json({ error: message }, { status: typeof status === 'number' ? status : 500 })
  }
}
