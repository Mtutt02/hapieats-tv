import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { mux, getThumbnailUrl } from '@/lib/mux'

// Disable body parsing — Mux needs raw body for signature verification
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const headersList = headers()
  const muxSignature = headersList.get('mux-signature')

  // Verify webhook signature — required in all environments.
  // Set MUX_WEBHOOK_SECRET in Vercel env vars from the Mux dashboard.
  if (!process.env.MUX_WEBHOOK_SECRET) {
    console.error('[mux/webhook] MUX_WEBHOOK_SECRET not configured — rejecting request')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }
  try {
    mux.webhooks.verifySignature(
      body,
      { 'mux-signature': muxSignature ?? '' },
      process.env.MUX_WEBHOOK_SECRET
    )
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body)
  const supabase = createServiceClient()

  switch (event.type) {
    case 'video.upload.asset_created': {
      // Upload started — link mux_asset_id to our video record
      const uploadId = event.data.upload_id
      const assetId = event.data.id

      await supabase
        .from('videos')
        .update({ mux_asset_id: assetId, status: 'processing' })
        .eq('mux_upload_id', uploadId)
      break
    }

    case 'video.asset.ready': {
      // Video is ready to stream
      const asset = event.data
      const playbackId = asset.playback_ids?.[0]?.id ?? null

      await supabase
        .from('videos')
        .update({
          status: 'ready',
          mux_playback_id: playbackId,
          duration: Math.floor(asset.duration ?? 0),
          thumbnail_url: playbackId ? getThumbnailUrl(playbackId) : null,
          published_at: new Date().toISOString(),
        })
        .eq('mux_asset_id', asset.id)

      // Increment video_count on the channel
      const { data: video } = await supabase
        .from('videos')
        .select('channel_id')
        .eq('mux_asset_id', asset.id)
        .single()

      if (video?.channel_id) {
        await supabase.rpc('increment_channel_video_count', { channel_id: video.channel_id })
      }
      break
    }

    case 'video.asset.errored': {
      await supabase
        .from('videos')
        .update({ status: 'errored' })
        .eq('mux_asset_id', event.data.id)
      break
    }

    case 'video.asset.deleted': {
      await supabase
        .from('videos')
        .update({ status: 'errored', mux_playback_id: null })
        .eq('mux_asset_id', event.data.id)
      break
    }

    case 'video.live_stream.active': {
      await supabase
        .from('live_streams')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('mux_live_stream_id', event.data.id)
      break
    }

    case 'video.live_stream.idle': {
      await supabase
        .from('live_streams')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('mux_live_stream_id', event.data.id)
      break
    }

    case 'video.asset.live_stream_completed': {
      await supabase
        .from('live_streams')
        .update({ recording_asset_id: event.data.id })
        .eq('mux_live_stream_id', event.data.live_stream_id)
      break
    }
  }

  return NextResponse.json({ received: true })
}
