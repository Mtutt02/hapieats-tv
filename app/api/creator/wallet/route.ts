import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { payoutsPausedResponse } from '@/lib/payments-pause'

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
  const paused = payoutsPausedResponse()
  if (paused) return paused
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { amount_cents } = await req.json()
  if (!amount_cents || amount_cents < 100) {
    return NextResponse.json({ error: 'Minimum payout is $1.00 (100 cents)' }, { status: 400 })
  }

  const service = createServiceClient()
  // The whole decision (wallet row locked FOR UPDATE -> checks -> mark pending, debit, log the
  // request) is ONE database function (request_creator_payout, round 5). It used to read the wallet,
  // check it and write it back as separate steps, so two concurrent requests both passed. The actual
  // Stripe transfer is still handled by admin/cron.
  const { data: result, error } = await service.rpc('request_creator_payout', {
    p_creator: user.id,
    p_amount_cents: Math.floor(Number(amount_cents)),
  })
  if (error || !result) {
    console.error('[creator/wallet] request_creator_payout failed:', error)
    return NextResponse.json({ error: 'Could not request the payout. Please try again.' }, { status: 500 })
  }

  switch (result.status) {
    case 'ok':
      return NextResponse.json({ success: true, payout_requested_cents: amount_cents })
    case 'not_found':
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    case 'pending':
      return NextResponse.json({ error: 'A payout is already pending' }, { status: 409 })
    case 'insufficient':
      return NextResponse.json({ error: 'Insufficient redeemable balance', available: result.available }, { status: 402 })
    case 'stripe_required':
      return NextResponse.json({ error: 'Stripe Connect not set up. Connect your bank account first.', stripe_required: true }, { status: 402 })
    default:
      console.error('[creator/wallet] unexpected request_creator_payout result:', result)
      return NextResponse.json({ error: 'Could not request the payout. Please try again.' }, { status: 500 })
  }
}
