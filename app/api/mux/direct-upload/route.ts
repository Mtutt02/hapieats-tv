import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { video as muxVideo } from '@/lib/mux'

export const dynamic = 'force-dynamic'

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

    const muxId = process.env.MUX_TOKEN_ID ?? ''
    if (!muxId || muxId.startsWith('your-') || muxId.length < 10) {
      return NextResponse.json({ error: 'Mux credentials not configured' }, { status: 503 })
    }

    const upload = await muxVideo.uploads.create({
      cors_origin: process.env.NEXT_PUBLIC_APP_URL ?? '*',
      new_asset_settings: {
        playback_policy: ['public'],
        encoding_tier: 'baseline',
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
