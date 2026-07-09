import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { video as muxVideo } from '@/lib/mux'
import { CLIP_CATEGORIES } from '@/lib/clips/types'
import { insertVideoTolerant } from '@/lib/videos/tolerant-insert'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { title, description, channelId, visibility, pricingModel, price, postType, tags, stationId, clipStart, clipEnd, overlays, musicTrack, filters, voiceoverUrl, isClip, clipCategory } = body

    // Clips — validate the category against the shared allowed list
    const wantsClip = isClip === true
    const safeClipCategory = wantsClip && typeof clipCategory === 'string' && (CLIP_CATEGORIES as readonly string[]).includes(clipCategory)
      ? clipCategory
      : wantsClip ? 'food' : null

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

    // If channelId provided, verify the user may post to it:
    // owner always can; others only when the channel has open_posting enabled.
    if (channelId) {
      const { data: channel, error: channelError } = await serviceClient
        .from('channels')
        .select('id, creator_id, open_posting')
        .eq('id', channelId)
        .single()

      if (channelError && channelError.message?.includes('open_posting')) {
        // Live DB doesn't have the open_posting column yet — fall back to owner-only check
        const { data: ownedChannel } = await serviceClient
          .from('channels')
          .select('id')
          .eq('id', channelId)
          .eq('creator_id', user.id)
          .single()

        if (!ownedChannel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
      } else {
        if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
        if (channel.creator_id !== user.id && channel.open_posting !== true) {
          return NextResponse.json({ error: 'This channel does not accept community posts' }, { status: 403 })
        }
      }
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
    const baseRow = {
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
      edit_overlays: overlays ?? null,
      edit_music_track: musicTrack ?? null,
      edit_filters: filters ?? null,
      edit_voiceover_url: voiceoverUrl ?? null,
    }

    // Tolerant insert — automatically drops any column the live DB doesn't
    // have yet (pending migrations) so uploads never break on schema drift.
    const result = await insertVideoTolerant(serviceClient, {
      ...baseRow,
      is_clip: wantsClip,
      clip_category: safeClipCategory,
    })

    if ('error' in result) {
      return NextResponse.json({ error: 'Failed to create video record' }, { status: 500 })
    }

    return NextResponse.json({
      uploadUrl: upload.url,
      uploadId: upload.id,
      videoId: result.id,
    })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number; statusCode?: number }
    console.error('Mux upload error:', err)
    const status = e?.status ?? e?.statusCode ?? 500
    const message = e?.message ?? 'Internal server error'
    return NextResponse.json({ error: message }, { status: typeof status === 'number' ? status : 500 })
  }
}
