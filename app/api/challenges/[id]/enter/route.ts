import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description, video_id } = await req.json()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (typeof title !== 'string' || title.trim().length > 200) {
    return NextResponse.json({ error: 'title must be 200 characters or fewer' }, { status: 400 })
  }
  if (description && (typeof description !== 'string' || description.length > 2000)) {
    return NextResponse.json({ error: 'description must be 2,000 characters or fewer' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verify challenge is active
  const { data: challenge } = await service
    .from('creator_challenges')
    .select('id, status, max_entries_per_creator')
    .eq('id', params.id)
    .single()

  if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
  if (!['active'].includes(challenge.status)) {
    return NextResponse.json({ error: 'Challenge is not accepting entries' }, { status: 400 })
  }

  // Check if already entered
  const { data: existing } = await service
    .from('challenge_entries')
    .select('id')
    .eq('challenge_id', params.id)
    .eq('creator_id', user.id)
    .single()

  if (existing) return NextResponse.json({ error: 'Already entered this challenge' }, { status: 409 })

  const { data, error } = await service.from('challenge_entries').insert({
    challenge_id: params.id,
    creator_id: user.id,
    title,
    description,
    video_id: video_id ?? null,
    status: 'pending',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update streak
  await service.rpc('update_creator_streak', { p_creator_id: user.id, p_activity_type: 'challenge' })

  return NextResponse.json({ entry: data }, { status: 201 })
}
