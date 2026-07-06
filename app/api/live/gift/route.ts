import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ── POST /api/live/gift ────────────────────────────────────────────────────────
// Send a gift during a live stream.
// Body: { stream_id: string, gift_id: string, quantity?: number }
//
// Flow:
//  1. Auth + validate input
//  2. Verify stream is active + get creator_id (NEVER from client)
//  3. Fetch gift definition from live_gifts table (NOT hardcoded)
//  4. Debit sender via record_token_movement RPC (atomic, SELECT FOR UPDATE)
//  5. Insert live_gift_transactions row
//  6. Credit creator_wallets (tokens_received + monetary earnings)
//  7. Post gift_event message to live_chat_messages
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { stream_id: string; gift_id: string; quantity?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { stream_id, gift_id, quantity = 1 } = body

  if (!stream_id) return NextResponse.json({ error: 'stream_id required' }, { status: 400 })
  if (!gift_id)   return NextResponse.json({ error: 'gift_id required' }, { status: 400 })
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return NextResponse.json({ error: 'quantity must be between 1 and 10' }, { status: 400 })
  }

  const service = createServiceClient()

  // ── Verify stream is live ──────────────────────────────────────────────────
  const { data: stream } = await service
    .from('live_streams')
    .select('id, creator_id, status, title')
    .eq('id', stream_id)
    .single()

  if (!stream) return NextResponse.json({ error: 'Stream not found' }, { status: 404 })
  if (stream.status === 'ended') {
    return NextResponse.json({ error: 'Stream has ended' }, { status: 400 })
  }
  if (stream.creator_id === user.id) {
    return NextResponse.json({ error: 'Cannot send gifts to your own stream' }, { status: 400 })
  }

  // ── Fetch gift definition from DB (never trust client-supplied cost) ───────
  const { data: gift } = await service
    .from('live_gifts')
    .select('id, name, emoji, token_cost, creator_pct, platform_pct, circle_pct')
    .eq('id', gift_id)
    .eq('is_active', true)
    .single()

  if (!gift) return NextResponse.json({ error: 'Gift not found or unavailable' }, { status: 404 })

  const totalTokens = gift.token_cost * quantity

  // ── Debit sender tokens (atomic — SELECT FOR UPDATE inside RPC) ────────────
  const { error: debitErr } = await service.rpc('record_token_movement', {
    p_user_id:      user.id,
    p_type:         'live_gift',
    p_amount:       -totalTokens,
    p_related_user: stream.creator_id,
    p_description:  `Sent ${quantity > 1 ? `${quantity}x ` : ''}${gift.emoji} ${gift.name} on "${stream.title}"`,
    p_metadata:     { stream_id, gift_id, quantity },
  })

  if (debitErr) {
    if (debitErr.message?.includes('INSUFFICIENT_BALANCE')) {
      return NextResponse.json(
        { error: 'Not enough tokens', code: 'INSUFFICIENT_BALANCE' },
        { status: 402 }
      )
    }
    console.error('[live/gift] debit error:', debitErr)
    return NextResponse.json({ error: 'Failed to deduct tokens' }, { status: 500 })
  }

  // ── Get updated sender balance ─────────────────────────────────────────────
  const { data: walletAfter } = await service
    .from('hapi_tokens')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  // ── Fetch token→cents conversion rate ─────────────────────────────────────
  const { data: settings } = await service
    .from('platform_settings')
    .select('value')
    .eq('key', 'token_conversion_rate')
    .single()
  const rate           = (settings?.value as { creator_pct?: number; cents_per_token?: number } | null) ?? {}
  const centsPerToken  = rate.cents_per_token ?? 1
  const creatorCents   = Math.floor(totalTokens * centsPerToken * (gift.creator_pct  / 100))
  const platformCents  = Math.floor(totalTokens * centsPerToken * (gift.platform_pct / 100))
  const circleCents    = Math.floor(totalTokens * centsPerToken * (gift.circle_pct   / 100))

  // ── Record gift transaction ────────────────────────────────────────────────
  const { data: txn } = await service
    .from('live_gift_transactions')
    .insert({
      sender_id:            user.id,
      recipient_id:         stream.creator_id,
      stream_id,
      gift_id,
      quantity,
      total_tokens:         totalTokens,
      creator_earned_cents: creatorCents,
      platform_fee_cents:   platformCents,
      circle_pool_cents:    circleCents,
    })
    .select('id')
    .single()

  // ── Credit creator wallet ──────────────────────────────────────────────────
  await service.rpc('ensure_creator_wallet', { p_creator_id: stream.creator_id })

  const { data: cw } = await service
    .from('creator_wallets')
    .select('tokens_received, redeemable_cents, lifetime_earnings_cents, monthly_earnings')
    .eq('creator_id', stream.creator_id)
    .single()

  const month   = new Date().toISOString().slice(0, 7)
  const monthly = ((cw?.monthly_earnings as Record<string, Record<string, number>> | null) ?? {})
  monthly[month] = monthly[month] ?? { gifts: 0, challenges: 0, goals: 0, circle: 0 }
  monthly[month].gifts = (monthly[month].gifts ?? 0) + creatorCents

  await service.from('creator_wallets').upsert({
    creator_id:              stream.creator_id,
    tokens_received:         (cw?.tokens_received          ?? 0) + totalTokens,
    redeemable_cents:        (cw?.redeemable_cents          ?? 0) + creatorCents,
    lifetime_earnings_cents: (cw?.lifetime_earnings_cents   ?? 0) + creatorCents,
    monthly_earnings:        monthly,
    updated_at:              new Date().toISOString(),
  }, { onConflict: 'creator_id' })

  // ── Update creator streak ──────────────────────────────────────────────────
  await service.rpc('update_creator_streak', {
    p_creator_id:    stream.creator_id,
    p_activity_type: 'gift_received',
  }).catch(() => { /* non-fatal */ })

  // ── Post gift_event to live chat (Realtime picks it up for all viewers) ────
  await service.from('live_chat_messages').insert({
    stream_id,
    sender_id:   user.id,
    message:     `sent ${quantity > 1 ? `${quantity}x ` : ''}${gift.emoji} ${gift.name}`,
    type:        'gift_event',
    gift_name:   gift.name,
    gift_emoji:  gift.emoji,
    gift_tokens: totalTokens,
    is_private:  false,
  }).catch(() => { /* non-fatal — gift already succeeded */ })

  return NextResponse.json({
    success:           true,
    transaction_id:    txn?.id ?? null,
    gift:              { name: gift.name, emoji: gift.emoji, token_cost: gift.token_cost },
    tokens_spent:      totalTokens,
    remaining_balance: walletAfter?.balance ?? null,
    creator_earned:    { tokens: totalTokens, cents: creatorCents },
  })
}

// ── GET /api/live/gift?stream_id=xxx ─────────────────────────────────────────
// Returns the gift catalog (no auth required — public)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const streamId = searchParams.get('stream_id')

  const service = createServiceClient()

  if (streamId) {
    // Recent gifts sent on this specific stream
    const { data } = await service
      .from('live_gift_transactions')
      .select(`
        id, total_tokens, quantity, created_at,
        gift:gift_id ( name, emoji, token_cost ),
        sender:sender_id ( display_name, username, avatar_url )
      `)
      .eq('stream_id', streamId)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json(data ?? [])
  }

  // Full gift catalog
  const { data } = await service
    .from('live_gifts')
    .select('id, name, emoji, token_cost, display_priority, animation_key')
    .eq('is_active', true)
    .order('display_priority', { ascending: true })

  return NextResponse.json(data ?? [])
}
