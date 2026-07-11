import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** GET /api/series/[seriesId] — series + ordered videos (public) */
export async function GET(_req: NextRequest, { params }: { params: { seriesId: string } }) {
  const service = createServiceClient()
  const { data: series } = await service
    .from('series')
    .select('id, channel_id, creator_id, title, slug, description, thumbnail_url, is_public, video_count, created_at')
    .eq('id', params.seriesId)
    .single()
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  const { data: items } = await service
    .from('series_videos')
    .select('position, video:videos(id, title, thumbnail_url, mux_playback_id, duration, view_count, status, is_clip)')
    .eq('series_id', params.seriesId)
    .order('position', { ascending: true })

  const videos = (items ?? [])
    .map((r: any) => r.video)
    .filter((v: any) => v && v.status === 'ready' && !v.is_clip)

  return NextResponse.json({ series, videos })
}

async function assertOwner(seriesId: string, userId: string) {
  const service = createServiceClient()
  const { data } = await service.from('series').select('id').eq('id', seriesId).eq('creator_id', userId).single()
  return !!data
}

/** PATCH /api/series/[seriesId] — edit title/description/visibility */
export async function PATCH(req: NextRequest, { params }: { params: { seriesId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await assertOwner(params.seriesId, user.id))) return NextResponse.json({ error: 'Not yours' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string' && body.title.trim().length >= 2) patch.title = body.title.trim().slice(0, 120)
  if (typeof body.description === 'string') patch.description = body.description.trim().slice(0, 2000) || null
  if (typeof body.isPublic === 'boolean') patch.is_public = body.isPublic
  if (typeof body.thumbnailUrl === 'string') patch.thumbnail_url = body.thumbnailUrl

  const service = createServiceClient()
  await service.from('series').update(patch).eq('id', params.seriesId)
  return NextResponse.json({ ok: true })
}

/** DELETE /api/series/[seriesId] */
export async function DELETE(_req: NextRequest, { params }: { params: { seriesId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await assertOwner(params.seriesId, user.id))) return NextResponse.json({ error: 'Not yours' }, { status: 403 })

  const service = createServiceClient()
  await service.from('series').delete().eq('id', params.seriesId)
  return NextResponse.json({ ok: true })
}
