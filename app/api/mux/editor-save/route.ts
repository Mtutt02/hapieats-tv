import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/mux/editor-save
 * Creates a video DB record tied to an existing Mux upload (from Munchor Studio).
 * Body: { uploadId, title, description?, channelId?, stationId?, visibility?, pricingModel?, price? }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { uploadId, title, description, channelId, stationId, visibility, pricingModel, price } = body

    if (!uploadId) return NextResponse.json({ error: 'uploadId is required' }, { status: 400 })
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

    // Monetization guard
    if (pricingModel && pricingModel !== 'free') {
      const { data: prof } = await supabase.from('profiles').select('is_creator').eq('id', user.id).single()
      if (!prof?.is_creator) {
        return NextResponse.json({ error: 'Creator account required to set paid pricing' }, { status: 403 })
      }
    }

    const service = createServiceClient()

    // If channelId provided, verify ownership
    if (channelId) {
      const { data: channel } = await service
        .from('channels')
        .select('id')
        .eq('id', channelId)
        .eq('creator_id', user.id)
        .single()
      if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    const { data: videoRecord, error } = await service
      .from('videos')
      .insert({
        title,
        description: description ?? null,
        channel_id: channelId ?? null,
        station_id: stationId ?? null,
        creator_id: user.id,
        mux_upload_id: uploadId,
        status: 'uploading',
        visibility: visibility ?? 'public',
        pricing_model: pricingModel ?? 'free',
        price: price ?? null,
        post_type: channelId ? 'channel' : stationId ? 'station' : 'general',
      })
      .select('id')
      .single()

    if (error || !videoRecord) {
      console.error('DB error:', error)
      return NextResponse.json({ error: 'Failed to create video record' }, { status: 500 })
    }

    return NextResponse.json({ videoId: videoRecord.id })
  } catch (err: unknown) {
    const e = err as { message?: string }
    console.error('editor-save error:', err)
    return NextResponse.json({ error: e?.message ?? 'Internal server error' }, { status: 500 })
  }
}
