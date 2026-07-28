import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)
}

/** GET /api/series?channelId=...  — list series in a channel (public) */
export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get('channelId')
  if (!channelId) return NextResponse.json({ error: 'channelId is required' }, { status: 400 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('series')
    .select('id, title, slug, description, thumbnail_url, is_public, video_count, created_at')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ series: [] })
  return NextResponse.json({ series: data ?? [] })
}

/** POST /api/series  { channelId, title, description?, isPublic? } — create a series */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channelId, title, description, isPublic = true } = await req.json().catch(() => ({}))
  if (!channelId || !title || typeof title !== 'string' || title.trim().length < 2) {
    return NextResponse.json({ error: 'channelId and a title (2+ chars) are required' }, { status: 400 })
  }

  const service = createServiceClient()
  // ownership: the channel must belong to the caller
  const { data: channel } = await service
    .from('channels').select('id').eq('id', channelId).eq('creator_id', user.id).single()
  if (!channel) return NextResponse.json({ error: 'Channel not found or not yours' }, { status: 404 })

  const { data: series, error } = await service
    .from('series')
    .insert({
      channel_id: channelId,
      creator_id: user.id,
      title: title.trim().slice(0, 120),
      slug: slugify(title),
      description: description?.trim()?.slice(0, 2000) || null,
      is_public: isPublic !== false,
    })
    .select('id, title, slug, description, video_count, created_at')
    .single()

  if (error || !series) {
    console.error('[series create]', error)
    return NextResponse.json({ error: 'Failed to create series' }, { status: 500 })
  }
  return NextResponse.json({ series }, { status: 201 })
}
