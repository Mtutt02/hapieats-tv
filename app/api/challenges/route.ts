import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // 'upcoming','active','voting','complete'
  const service = createServiceClient()

  let query = service
    .from('creator_challenges')
    .select('id, title, description, theme, cover_image_url, start_date, end_date, voting_start_date, voting_end_date, voting_type, token_vote_cost, status, prize_cash_cents, prize_tokens, prize_badge, prize_homepage_feature, created_at')
    .order('start_date', { ascending: false })
    .limit(50)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ challenges: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only admins can create challenges
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const {
    title, description, theme, cover_image_url,
    start_date, end_date, voting_start_date, voting_end_date,
    voting_type = 'free', token_vote_cost = 0, max_entries_per_creator = 1,
    prize_cash_cents = 0, prize_tokens = 0, prize_badge, prize_homepage_feature = false,
    judge_weight = 0.5, public_vote_weight = 0.5,
  } = body

  if (!title || !start_date || !end_date) {
    return NextResponse.json({ error: 'title, start_date, end_date required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service.from('creator_challenges').insert({
    title, description, theme, cover_image_url,
    start_date, end_date, voting_start_date, voting_end_date,
    voting_type, token_vote_cost, max_entries_per_creator,
    prize_cash_cents, prize_tokens, prize_badge, prize_homepage_feature,
    judge_weight, public_vote_weight,
    created_by: user.id,
    status: new Date(start_date) > new Date() ? 'upcoming' : 'active',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ challenge: data }, { status: 201 })
}
