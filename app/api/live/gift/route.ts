import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

// ── POST /api/live/gift ────────────────────────────────────────────────────────
// Send a gift during a live stream.
// Body: { stream_id: string, gift_id: string, quantity?: number, request_id?: string }
//
// Flow:
//  1. Auth + validate input
//  2. send_live_gift RPC does EVERYTHING that moves money in one transaction, under a
//     row lock on the sender's wallet: verifies the stream is live and who owns it (never
//     from the client), reads the gift price from live_gifts (never from the client), debits
//     the sender (never below zero), records the transaction, credits the creator wallet and
//     the circle pool. Any failure rolls the whole thing back.
//  3. Post gift_event message to live_chat_messages (best effort)
//
// Double-submit safety: the client sends a request_id per gift tap and reuses it for a retry.
// The same (sender, request_id) is charged once; a replay returns the original result.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`${user.id}:live-gift`, 15, 60_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Too many gifts — slow down a moment.' }, { status: 429 })

  let body: { stream_id: string; gift_id: string; quantity?: number; request_id?: string }
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
  // A client that sends no request_id still works, it just gets no replay protection.
  const requestId =
    typeof body.request_id === 'string' && body.request_id.length > 0 && body.request_id.length <= 100
      ? body.request_id
      : randomUUID()

  const service = createServiceClient()

  const { data: result, error } = await service.rpc('send_live_gift', {
    p_request_id: requestId,
    p_sender_id:  user.id,
    p_stream_id:  stream_id,
    p_gift_id:    gift_id,
    p_quantity:   quantity,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('INSUFFICIENT_BALANCE')) {
      return NextResponse.json({ error: 'Not enough tokens', code: 'INSUFFICIENT_BALANCE' }, { status: 402 })
    }
    if (msg.includes('STREAM_NOT_FOUND'))  return NextResponse.json({ error: 'Stream not found' }, { status: 404 })
    if (msg.includes('STREAM_ENDED'))      return NextResponse.json({ error: 'Stream has ended' }, { status: 400 })
    if (msg.includes('OWN_STREAM'))        return NextResponse.json({ error: 'Cannot send gifts to your own stream' }, { status: 400 })
    if (msg.includes('GIFT_UNAVAILABLE'))  return NextResponse.json({ error: 'Gift not found or unavailable' }, { status: 404 })
    console.error('[live/gift] send_live_gift error:', error)
    return NextResponse.json({ error: 'Could not send the gift — you were not charged' }, { status: 500 })
  }

  const isNew = result?.status === 'ok'

  if (isNew) {
    // ── Update creator streak (best effort) ──────────────────────────────────
    try {
      await service.rpc('update_creator_streak', {
        p_creator_id:    result.creator_id,
        p_activity_type: 'gift_received',
      })
    } catch (e) {
      console.error('[live/gift] streak update failed (non-fatal):', e)
    }

    // ── Post gift_event to live chat (Realtime picks it up for all viewers) ──
    try {
      await service.from('live_chat_messages').insert({
        stream_id,
        sender_id:   user.id,
        message:     `sent ${quantity > 1 ? `${quantity}x ` : ''}${result.gift.emoji} ${result.gift.name}`,
        type:        'gift_event',
        gift_name:   result.gift.name,
        gift_emoji:  result.gift.emoji,
        gift_tokens: result.total_tokens,
        is_private:  false,
      })
    } catch (e) {
      console.error('[live/gift] gift chat message failed (non-fatal):', e)
    }
  }

  return NextResponse.json({
    success:           true,
    duplicate:         !isNew,
    transaction_id:    result?.transaction_id ?? null,
    gift:              result?.gift,
    tokens_spent:      result?.total_tokens,
    remaining_balance: result?.remaining_balance ?? null,
    creator_earned:    { tokens: result?.total_tokens, cents: result?.creator_cents },
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
