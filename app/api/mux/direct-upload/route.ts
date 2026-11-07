import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { video as muxVideo } from '@/lib/mux'
import { checkRateLimit } from '@/lib/rate-limit'
import { UPLOAD_PASSTHROUGH_PREFIX } from '@/lib/mux-upload-guard'

export const dynamic = 'force-dynamic'

// Issuing an upload URL is cheap, but each finished upload becomes a paid Mux asset.
// Cap how many URLs one account can request per hour (per serverless instance).
const DIRECT_UPLOAD_LIMIT_PER_HOUR = 20

/**
 * GET /api/mux/direct-upload
 * Returns a signed Mux direct-upload URL + upload ID without creating a DB record.
 * Used by the Munchor Studio editor to upload the exported video directly to Mux.
 * The caller is responsible for creating the video DB record after upload completes
 * by posting to /api/mux/editor-save with the uploadId + metadata.
 */
export async function GET(_req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = checkRateLimit(`${user.id}:mux-direct-upload`, DIRECT_UPLOAD_LIMIT_PER_HOUR, 60 * 60_000)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many uploads. Try again later.' }, { status: 429 })
    }

    const muxId = process.env.MUX_TOKEN_ID ?? ''
    if (!muxId || muxId.startsWith('your-') || muxId.length < 10) {
      return NextResponse.json({ error: 'Mux credentials not configured' }, { status: 503 })
    }

    // passthrough binds the upload to this user; editor-save checks it before saving.
    const upload = await muxVideo.uploads.create({
      cors_origin: process.env.NEXT_PUBLIC_APP_URL ?? '*',
      new_asset_settings: {
        playback_policy: ['public'],
        encoding_tier: 'baseline',
        passthrough: `${UPLOAD_PASSTHROUGH_PREFIX}${user.id}`,
      },
    })

    return NextResponse.json({
      uploadUrl: upload.url,
      uploadId: upload.id,
    })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    console.error('direct-upload error:', err)
    return NextResponse.json(
      { error: e?.message ?? 'Internal server error' },
      { status: typeof e?.status === 'number' ? e.status : 500 }
    )
  }
}
