import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function ownedSeries(seriesId: string, userId: string) {
  const service = createServiceClient()
  const { data } = await service.from('series').select('id, channel_id').eq('id', seriesId).eq('creator_id', userId).single()
  return data
}

/**
 * POST /api/series/[seriesId]/videos  { videoId } | { videoIds: [] }
 * Add one or more of the caller's videos to the series (append to the end).
 * Videos can be added any time after the series is created.
 */
export async function POST(req: NextRequest, { params }: { params: { seriesId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const series = await ownedSeries(params.seriesId, user.id)
  if (!series) return NextResponse.json({ error: 'Series not found or not yours' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const ids: string[] = body.videoIds ?? (body.videoId ? [body.videoId] : [])
  if (ids.length === 0) return NextResponse.json({ error: 'videoId(s) required' }, { status: 400 })

  const service = createServiceClient()
  // only videos owned by the caller may be added
  const { data: owned } = await service
    .from('videos').select('id').eq('creator_id', user.id).in('id', ids)
  const ownedIds = new Set((owned ?? []).map(v => v.id))
  const toAdd = ids.filter(id => ownedIds.has(id))
  if (toAdd.length === 0) return NextResponse.json({ error: 'No eligible videos to add' }, { status: 400 })

  // append after the current max position
  const { data: last } = await service
    .from('series_videos').select('position').eq('series_id', params.seriesId)
    .order('position', { ascending: false }).limit(1).maybeSingle()
  let pos = (last?.position ?? -1) + 1

  const rows = toAdd.map(video_id => ({ series_id: params.seriesId, video_id, position: pos++ }))
  const { error } = await service.from('series_videos').upsert(rows, { onConflict: 'series_id,video_id' })
  if (error) {
    console.error('[series add video]', error)
    return NextResponse.json({ error: 'Failed to add to series' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, added: toAdd.length })
}

/** DELETE /api/series/[seriesId]/videos?videoId=... — remove a video from the series */
export async function DELETE(req: NextRequest, { params }: { params: { seriesId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await ownedSeries(params.seriesId, user.id))) return NextResponse.json({ error: 'Not yours' }, { status: 403 })

  const videoId = req.nextUrl.searchParams.get('videoId')
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  const service = createServiceClient()
  await service.from('series_videos').delete().eq('series_id', params.seriesId).eq('video_id', videoId)
  return NextResponse.json({ ok: true })
}

/** PATCH /api/series/[seriesId]/videos  { order: [videoId,...] } — reorder */
export async function PATCH(req: NextRequest, { params }: { params: { seriesId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await ownedSeries(params.seriesId, user.id))) return NextResponse.json({ error: 'Not yours' }, { status: 403 })

  const { order } = await req.json().catch(() => ({ order: [] }))
  if (!Array.isArray(order)) return NextResponse.json({ error: 'order[] required' }, { status: 400 })

  const service = createServiceClient()
  await Promise.all(order.map((videoId: string, i: number) =>
    service.from('series_videos').update({ position: i }).eq('series_id', params.seriesId).eq('video_id', videoId)
  ))
  return NextResponse.json({ ok: true })
}
