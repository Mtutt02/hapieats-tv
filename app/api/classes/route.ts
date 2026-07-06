import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')       // live | recorded | series
  const category = searchParams.get('category')
  const skill = searchParams.get('skill')
  const channelId = searchParams.get('channelId')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 20
  const offset = (page - 1) * limit

  const supabase = createClient()
  let query = supabase
    .from('classes')
    .select(`
      *,
      instructor:profiles(id, username, display_name, avatar_url),
      channel:channels(id, name, slug)
    `, { count: 'exact' })
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type) query = query.eq('type', type)
  if (category) query = query.eq('category', category)
  if (skill) query = query.eq('skill_level', skill)
  if (channelId) query = query.eq('channel_id', channelId)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ classes: data, total: count, page, limit })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, category, skill_level, type, price, channel_id, scheduled_at, thumbnail_url } = body

  if (!title || title.length < 3) return NextResponse.json({ error: 'Title must be at least 3 characters' }, { status: 400 })
  if (!channel_id) return NextResponse.json({ error: 'channel_id is required' }, { status: 400 })

  // Verify channel ownership
  const { data: channel } = await supabase
    .from('channels')
    .select('id')
    .eq('id', channel_id)
    .eq('creator_id', user.id)
    .single()
  if (!channel) return NextResponse.json({ error: 'Channel not found or not yours' }, { status: 403 })

  const { data, error } = await supabase
    .from('classes')
    .insert({
      instructor_id: user.id,
      channel_id,
      title,
      description: description ?? null,
      category: category ?? 'general',
      skill_level: skill_level ?? 'beginner',
      type: type ?? 'recorded',
      price: price ?? 0,
      scheduled_at: scheduled_at ?? null,
      thumbnail_url: thumbnail_url ?? null,
      is_published: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
