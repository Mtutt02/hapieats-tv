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
