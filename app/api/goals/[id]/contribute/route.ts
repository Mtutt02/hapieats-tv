import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tokens, message } = await req.json()
  if (!tokens || tokens < 1) return NextResponse.json({ error: 'tokens must be >= 1' }, { status: 400 })
  if (tokens > 100000) return NextResponse.json({ error: 'tokens must be <= 100,000 per contribution' }, { status: 400 })
  if (message && (typeof message !== 'string' || message.length > 500)) {
    return NextResponse.json({ error: 'message must be 500 characters or fewer' }, { status: 400 })
  }

  const service = createServiceClient()

  // Fetch goal
  const { data: goal } = await service
    .from('creator_goals')
    .select('id, creator_id, title, status, current_tokens, target_tokens')
    .eq('id', params.id)
    .single()

  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  if (goal.status !== 'active') return NextResponse.json({ error: 'Goal is not active' }, { status: 400 })
  if (goal.creator_id === user.id) return NextResponse.json({ error: 'Cannot contribute to your own goal' }, { status: 400 })

  // Check balance
  const { data: wallet } = await service.from('hapi_tokens').select('balance').eq('user_id', user.id).single()
  if (!wallet || wallet.balance < tokens) {
    return NextResponse.json({ error: 'Insufficient tokens', balance: wallet?.balance ?? 0 }, { status: 402 })
  }

  // Debit tokens from contributor (atomic — raises INSUFFICIENT_BALANCE if race condition)
  const { error: debitErr } = await service.rpc('record_token_movement', {
    p_user_id: user.id,
    p_type: 'creator_goal_contribution',
    p_amount: -tokens,
    p_related_user: goal.creator_id,
    p_description: `Contributed ${tokens} tokens to goal: ${goal.title}`,
    p_metadata: { goal_id: params.id },
  })
  if (debitErr) {
    if (debitErr.message?.includes('INSUFFICIENT_BALANCE')) {
      return NextResponse.json({ error: 'Insufficient tokens' }, { status: 402 })
    }
    return NextResponse.json({ error: 'Failed to deduct tokens' }, { status: 500 })
  }

  // Record contribution (trigger handles goal current_tokens update)
  const { data: contribution, error: contribErr } = await service.from('goal_contributions').insert({
    goal_id: params.id,
    contributor_id: user.id,
    tokens,
    message: message ?? null,
  }).select().single()

  if (contribErr) return NextResponse.json({ error: contribErr.message }, { status: 500 })

  // Credit creator wallet
  await service.rpc('ensure_creator_wallet', { p_creator_id: goal.creator_id })
  const { data: cw } = await service.from('creator_wallets').select('monthly_earnings, redeemable_cents, lifetime_earnings_cents, tokens_received').eq('creator_id', goal.creator_id).single()

  // Fetch platform settings
  const { data: settings } = await service.from('platform_settings').select('value').eq('key', 'token_conversion_rate').single()
  const rate = settings?.value as Record<string, number> ?? { creator_pct: 70, cents_per_token: 1 }
  const centsPerToken = rate.cents_per_token ?? 1
  const creatorCents = Math.floor(tokens * centsPerToken * (rate.creator_pct / 100))

  const month = new Date().toISOString().slice(0, 7)
  const monthly = (cw?.monthly_earnings ?? {}) as Record<string, Record<string, number>>
  monthly[month] = monthly[month] ?? { gifts: 0, challenges: 0, goals: 0, circle: 0 }
  monthly[month].goals = (monthly[month].goals ?? 0) + creatorCents

  await service.from('creator_wallets').upsert({
    creator_id: goal.creator_id,
    tokens_received: (cw?.tokens_received ?? 0) + tokens,
    redeemable_cents: (cw?.redeemable_cents ?? 0) + creatorCents,
    lifetime_earnings_cents: (cw?.lifetime_earnings_cents ?? 0) + creatorCents,
    monthly_earnings: monthly,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'creator_id' })

  // Fetch updated goal
  const { data: updatedGoal } = await service
    .from('creator_goals')
    .select('id, current_tokens, target_tokens, status')
    .eq('id', params.id)
    .single()

  return NextResponse.json({
    success: true,
    contribution,
    goal_progress: updatedGoal,
    tokens_contributed: tokens,
  })
}
