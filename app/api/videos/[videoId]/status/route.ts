import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { video as muxVideo } from '@/lib/mux'

export const runtime = 'nodejs'

/**
 * GET /api/videos/[videoId]/status
 *
 * Called by UploadStudio to poll processing progress after a file upload
 * completes.  If the video is still in 'uploading'/'processing' state and
 * we have a Mux asset ID, we ask Mux directly and update the DB if the
 * asset is now ready.  This means videos become 'ready' even if the Mux
 * webhook hasn't been configured yet.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { videoId: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: video } = await service
    .from('videos')
    .select('id, status, mux_asset_id, mux_upload_id, mux_playback_id, thumbnail_url, duration')
    .eq('id', params.videoId)
    .eq('creator_id', user.id)
    .single()

  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Already ready — nothing to do
  if (video.status === 'ready') {
    return NextResponse.json({
      status:         'ready',
      mux_playback_id: video.mux_playback_id,
      duration:        video.duration,
    })
  }

  // If we don't have an asset ID yet, check the upload to see if an asset was created
  if (!video.mux_asset_id && video.mux_upload_id) {
    const muxId = process.env.MUX_TOKEN_ID ?? ''
    if (muxId && !muxId.startsWith('your-') && muxId.length >= 10) {
      try {
        const upload = await muxVideo.uploads.retrieve(video.mux_upload_id)
        if (upload.asset_id) {
          await service
            .from('videos')
            .update({ mux_asset_id: upload.asset_id, status: 'processing' })
            .eq('id', params.videoId)
          video.mux_asset_id = upload.asset_id
          video.status       = 'processing'
        }
      } catch {
        // Mux not responding — return current status
        return NextResponse.json({ status: video.status })
      }
    }
  }

  // If we now have an asset ID, poll Mux for the latest status
  if (video.mux_asset_id) {
    const muxId = process.env.MUX_TOKEN_ID ?? ''
    if (!muxId || muxId.startsWith('your-') || muxId.length < 10) {
      return NextResponse.json({ status: video.status })
    }

    try {
      const asset = await muxVideo.assets.retrieve(video.mux_asset_id)

      if (asset.status === 'ready') {
        const playbackId = asset.playback_ids?.[0]?.id ?? null
        const thumb      = playbackId
          ? `https://image.mux.com/${playbackId}/thumbnail.jpg`
          : null

        await service
          .from('videos')
          .update({
            status:          'ready',
            mux_playback_id: playbackId,
            duration:        Math.floor(asset.duration ?? 0),
            thumbnail_url:   thumb,
            published_at:    new Date().toISOString(),
          })
          .eq('id', params.videoId)

        return NextResponse.json({
          status:          'ready',
          mux_playback_id: playbackId,
          duration:        Math.floor(asset.duration ?? 0),
        })
      }

      if (asset.status === 'errored') {
        await service
          .from('videos')
          .update({ status: 'errored' })
          .eq('id', params.videoId)
        return NextResponse.json({ status: 'errored' })
      }

      return NextResponse.json({ status: asset.status ?? video.status })
    } catch {
      return NextResponse.json({ status: video.status })
    }
  }

  return NextResponse.json({ status: video.status })
}
