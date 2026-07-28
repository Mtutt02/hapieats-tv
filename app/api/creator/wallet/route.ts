import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const [
    { data: wallet },
    { data: streak },
    { data: recentGifts },
    { data: recentGoalContribs },
  ] = await Promise.all([
    service.from('creator_wallets').select('*').eq('creator_id', user.id).single(),
    service.from('creator_streaks').select('current_streak, longest_streak, last_activity_date').eq('creator_id', user.id).single(),
    service.from('live_gift_transactions')
      .select('id, total_tokens, creator_earned_cents, created_at, gift:live_gifts(name, emoji), sender:profiles!live_gift_transactions_sender_id_fkey(username, display_name, avatar_url)')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
    service.from('goal_contributions')
      .select('id, tokens, created_at, goal:creator_goals(title), contributor:profiles!goal_contributions_contributor_id_fkey(username, display_name)')
      .in('goal_id',
        (await service.from('creator_goals').select('id').eq('creator_id', user.id)).data?.map(g => g.id) ?? []
      )
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return NextResponse.json({
    wallet: wallet ?? { creator_id: user.id, tokens_received: 0, pending_cents: 0, redeemable_cents: 0, lifetime_earnings_cents: 0, monthly_earnings: {}, payout_status: 'none' },
    streak: streak ?? null,
    recent_gifts: recentGifts ?? [],
    recent_goal_contributions: recentGoalContribs ?? [],
  })
}

// Request payout
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { amount_cents } = await req.json()
  if (!amount_cents || amount_cents < 100) {
    return NextResponse.json({ error: 'Minimum payout is $1.00 (100 cents)' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: wallet } = await service.from('creator_wallets').select('redeemable_cents, payout_status, stripe_connect_id').eq('creator_id', user.id).single()

  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
  if (wallet.payout_status === 'pending') return NextResponse.json({ error: 'A payout is already pending' }, { status: 409 })
  if (wallet.redeemable_cents < amount_cents) {
    return NextResponse.json({ error: 'Insufficient redeemable balance', available: wallet.redeemable_cents }, { status: 402 })
  }
  if (!wallet.stripe_connect_id) {
    return NextResponse.json({ error: 'Stripe Connect not set up. Connect your bank account first.', stripe_required: true }, { status: 402 })
  }

  // Mark payout as pending (actual Stripe transfer handled by admin/cron)
  await service.from('creator_wallets').update({
    payout_status: 'pending',
    redeemable_cents: wallet.redeemable_cents - amount_cents,
    updated_at: new Date().toISOString(),
  }).eq('creator_id', user.id)

  // Log in token ledger
  await service.from('token_ledger').insert({
    user_id: user.id,
    type: 'adjustment',
    amount: 0,
    balance_after: 0,
    description: `Payout requested: $${(amount_cents / 100).toFixed(2)}`,
    metadata: { type: 'payout_request', amount_cents },
  })

  return NextResponse.json({ success: true, payout_requested_cents: amount_cents })
}
