import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const creator_id = searchParams.get('creator_id')
  const status = searchParams.get('status') ?? 'active'

  const service = createServiceClient()
  let query = service
    .from('creator_goals')
    .select(`
      id, title, description, target_tokens, current_tokens, deadline,
      reward_description, cover_image_url, status, completed_at, created_at,
      creator:profiles!creator_goals_creator_id_fkey(id, username, display_name, avatar_url)
    `)
    .order('created_at', { ascending: false })
    .limit(20)

  if (creator_id) query = query.eq('creator_id', creator_id)
  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ goals: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only creators can create goals
  const { data: profile } = await supabase.from('profiles').select('is_creator').eq('id', user.id).single()
  if (!profile?.is_creator) {
    return NextResponse.json({ error: 'Only creators can create goals' }, { status: 403 })
  }

  const { title, description, target_tokens, deadline, reward_description, cover_image_url } = await req.json()
  if (!title || !target_tokens) {
    return NextResponse.json({ error: 'title and target_tokens required' }, { status: 400 })
  }
  if (typeof title !== 'string' || title.trim().length > 200) {
    return NextResponse.json({ error: 'title must be 200 characters or fewer' }, { status: 400 })
  }
  if (description && (typeof description !== 'string' || description.length > 2000)) {
    return NextResponse.json({ error: 'description must be 2,000 characters or fewer' }, { status: 400 })
  }
  if (reward_description && (typeof reward_description !== 'string' || reward_description.length > 500)) {
    return NextResponse.json({ error: 'reward_description must be 500 characters or fewer' }, { status: 400 })
  }
  if (cover_image_url && (typeof cover_image_url !== 'string' || !cover_image_url.startsWith('https://') || cover_image_url.length > 2000)) {
    return NextResponse.json({ error: 'cover_image_url must be a valid https URL' }, { status: 400 })
  }
  if (target_tokens < 1 || target_tokens > 1000000) {
    return NextResponse.json({ error: 'target_tokens must be between 1 and 1,000,000' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service.from('creator_goals').insert({
    creator_id: user.id,
    title,
    description,
    target_tokens,
    deadline,
    reward_description,
    cover_image_url,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ goal: data }, { status: 201 })
}
