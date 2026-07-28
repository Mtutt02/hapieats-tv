import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: streak } = await service
    .from('creator_streaks')
    .select('*')
    .eq('creator_id', user.id)
    .single()

  // Fetch streak bonus config
  const { data: settings } = await service
    .from('platform_settings')
    .select('value')
    .eq('key', 'streak_bonuses')
    .single()

  const bonuses = settings?.value as Record<string, number> ?? { '7': 50, '30': 250, '90': 1000 }

  return NextResponse.json({
    streak: streak ?? {
      creator_id: user.id,
      current_streak: 0,
      longest_streak: 0,
      last_activity_date: null,
      total_posts: 0,
      total_streams: 0,
      total_challenge_entries: 0,
      streak_7_claimed: false,
      streak_30_claimed: false,
      streak_90_claimed: false,
    },
    bonuses,
  })
}

// Claim a streak milestone bonus
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { milestone } = await req.json()  // '7', '30', or '90'
  if (!['7', '30', '90'].includes(milestone)) {
    return NextResponse.json({ error: 'Invalid milestone. Must be 7, 30, or 90.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: streak } = await service.from('creator_streaks').select('*').eq('creator_id', user.id).single()
  if (!streak) return NextResponse.json({ error: 'No streak found' }, { status: 404 })

  const claimedKey = `streak_${milestone}_claimed` as keyof typeof streak
  if (streak[claimedKey]) return NextResponse.json({ error: 'Milestone already claimed' }, { status: 409 })

  if (streak.current_streak < parseInt(milestone)) {
    return NextResponse.json({ error: `Current streak (${streak.current_streak}) has not reached ${milestone} days` }, { status: 400 })
  }

  // Fetch bonus amount
  const { data: settings } = await service.from('platform_settings').select('value').eq('key', 'streak_bonuses').single()
  const bonuses = settings?.value as Record<string, number> ?? { '7': 50, '30': 250, '90': 1000 }
  const bonusTokens = bonuses[milestone] ?? 0

  // Credit tokens
  if (bonusTokens > 0) {
    await service.rpc('record_token_movement', {
      p_user_id: user.id,
      p_type: 'streak_bonus',
      p_amount: bonusTokens,
      p_description: `${milestone}-day streak bonus`,
      p_metadata: { milestone, streak_length: streak.current_streak },
    })
  }

  // Mark milestone as claimed
  await service.from('creator_streaks').update({
    [claimedKey]: true,
    updated_at: new Date().toISOString(),
  }).eq('creator_id', user.id)

  return NextResponse.json({ success: true, tokens_awarded: bonusTokens, milestone })
}
