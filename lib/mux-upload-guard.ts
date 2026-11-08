import type { SupabaseClient } from '@supabase/supabase-js'
import { video as muxVideo } from '@/lib/mux'

/** Prefix on Mux `passthrough` that ties a direct upload to the account that requested it. */
export const UPLOAD_PASSTHROUGH_PREFIX = 'hapi-uploader:'

/** Max new videos per creator per rolling 24h. Override with MUX_DAILY_UPLOAD_QUOTA. */
export const DAILY_UPLOAD_QUOTA = Number(process.env.MUX_DAILY_UPLOAD_QUOTA) || 25

/** True only if Mux says this upload was issued to `userId`. Any lookup failure counts as "no". */
export async function uploadBelongsToUser(uploadId: string, userId: string): Promise<boolean> {
  try {
    const upload = await muxVideo.uploads.retrieve(uploadId)
    return upload.new_asset_settings?.passthrough === `${UPLOAD_PASSTHROUGH_PREFIX}${userId}`
  } catch {
    return false
  }
}

/**
 * True only if `playbackId` belongs to a Mux asset created through this app's direct-upload
 * flow for `userId` (same passthrough binding as uploads). Any lookup failure counts as "no".
 */
export async function playbackIdBelongsToUser(playbackId: string, userId: string): Promise<boolean> {
  try {
    const pb = await muxVideo.playbackIds.retrieve(playbackId)
    if (pb.object?.type !== 'asset') return false
    const asset = await muxVideo.assets.retrieve(pb.object.id)
    return asset.passthrough === `${UPLOAD_PASSTHROUGH_PREFIX}${userId}`
  } catch {
    return false
  }
}

/** Max direct-upload URLs per creator per rolling hour, counted in the database (all instances). */
export const HOURLY_UPLOAD_REQUEST_LIMIT = 20

/**
 * Upload URLs this creator requested in the last hour, from public.mux_upload_requests
 * (migration 20261108_p0_834_hardening.sql). Fails open (0) if the table is not there yet,
 * so the in-memory limiter stays the only guard until the migration is applied.
 */
export async function recentUploadRequestCount(service: SupabaseClient, userId: string): Promise<number> {
  try {
    const since = new Date(Date.now() - 60 * 60_000).toISOString()
    const { count } = await service
      .from('mux_upload_requests')
      .select('upload_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since)
    return count ?? 0
  } catch {
    return 0
  }
}

/** Record that `userId` was issued `uploadId`. Best effort: a missing table must not break uploads. */
export async function recordUploadRequest(service: SupabaseClient, uploadId: string, userId: string): Promise<void> {
  try {
    await service.from('mux_upload_requests').insert({ upload_id: uploadId, user_id: userId })
  } catch {
    // ledger unavailable; passthrough binding still protects editor-save
  }
}

/** How many video rows this creator has created in the last 24 hours. */
export async function dailyUploadCount(service: SupabaseClient, userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  const { count } = await service
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', userId)
    .gte('created_at', since)
  return count ?? 0
}
