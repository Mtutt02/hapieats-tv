import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { video as muxVideo } from '@/lib/mux'

/**
 * POST /api/admin/mux/sync
 * Pulls all assets from Mux API and syncs their status back to the DB.
 * Fixes videos stuck in "uploading" or "processing" that never got webhook callbacks.
 */
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['admin', 'superadmin'].includes(me.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const muxId = process.env.MUX_TOKEN_ID ?? ''
  if (!muxId || muxId.startsWith('your-') || muxId.length < 10) {
    return NextResponse.json({ error: 'Mux credentials not configured' }, { status: 503 })
  }

  const service = createServiceClient()

  // Fetch all Mux assets
  const assets = await muxVideo.assets.list({ limit: 100 })

  let updated = 0
  let skipped = 0

  for (const asset of assets.data) {
    const playbackId = asset.playback_ids?.[0]?.id ?? null
    const status = asset.status === 'ready' ? 'ready' : asset.status === 'errored' ? 'errored' : 'processing'

    // Try to find the video record by mux_asset_id
    const { data: videoRecord } = await service
      .from('videos')
      .select('id, status, mux_playback_id')
      .eq('mux_asset_id', asset.id)
      .single()

    if (videoRecord) {
      // Update if status changed or playback_id missing
      if (videoRecord.status !== status || !videoRecord.mux_playback_id) {
        const thumbUrl = playbackId
          ? `https://image.mux.com/${playbackId}/thumbnail.jpg?width=640&fit_mode=preserve&time=0`
          : null

        await service
          .from('videos')
          .update({
            status,
            mux_playback_id: playbackId,
            duration: Math.floor(asset.duration ?? 0),
            thumbnail_url: thumbUrl,
            ...(status === 'ready' && !videoRecord.mux_playback_id
              ? { published_at: new Date().toISOString() }
              : {}),
          })
          .eq('id', videoRecord.id)
        updated++
      } else {
        skipped++
      }
    }
  }

  // Also fix any videos still in "uploading" that have an asset ID (upload completed but webhook missed)
  const { data: stuckUploads } = await service
    .from('videos')
    .select('id, mux_upload_id')
    .eq('status', 'uploading')
    .not('mux_upload_id', 'is', null)

  let uploadFixed = 0
  for (const vid of stuckUploads ?? []) {
    try {
      const upload = await muxVideo.uploads.retrieve(vid.mux_upload_id!)
      if (upload.asset_id) {
        await service
          .from('videos')
          .update({ mux_asset_id: upload.asset_id, status: 'processing' })
          .eq('id', vid.id)
        uploadFixed++
      }
    } catch {
      // Upload may have expired — skip
    }
  }

  return NextResponse.json({
    success: true,
    assetsChecked: assets.data.length,
    videosUpdated: updated,
    videosSkipped: skipped,
    uploadsFixed: uploadFixed,
  })
}
