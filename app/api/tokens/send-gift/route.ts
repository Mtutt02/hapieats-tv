import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkRateLimit(`${user.id}:token-gift`, 15, 60_000)
    if (!rl.allowed) return NextResponse.json({ error: 'Too many gifts — slow down a moment.' }, { status: 429 })

    const { gift_id, recipient_id, stream_id, quantity = 1 } = await req.json()
    if (!gift_id || !recipient_id) {
      return NextResponse.json({ error: 'gift_id and recipient_id required' }, { status: 400 })
    }
    // SECURITY: quantity must be a small positive integer — a negative value
    // would flip the debit into a credit (token minting).
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return NextResponse.json({ error: 'quantity must be an integer between 1 and 10' }, { status: 400 })
    }
    if (user.id === recipient_id) {
      return NextResponse.json({ error: 'Cannot send gifts to yourself' }, { status: 400 })
    }

    const service = createServiceClient()

    // Fetch gift config
    const { data: gift, error: giftErr } = await service
      .from('live_gifts')
      .select('*')
      .eq('id', gift_id)
      .eq('is_active', true)
      .single()
    if (giftErr || !gift) return NextResponse.json({ error: 'Gift not found' }, { status: 404 })

    const totalTokens = gift.token_cost * quantity

    // Check sender balance
    const { data: wallet } = await service
      .from('hapi_tokens')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    if (!wallet || wallet.balance < totalTokens) {
      return NextResponse.json({ error: 'Insufficient tokens', balance: wallet?.balance ?? 0 }, { status: 402 })
    }

    // Fetch platform settings for conversion rate
    const { data: settings } = await service
      .from('platform_settings')
      .select('value')
      .eq('key', 'token_conversion_rate')
      .single()

    const rate = settings?.value as Record<string, number> ?? { creator_pct: 70, platform_pct: 20, circle_pool_pct: 10, cents_per_token: 1 }
    const centsPerToken = rate.cents_per_token ?? 1
    const totalCents = totalTokens * centsPerToken
    const creatorCents = Math.floor(totalCents * (rate.creator_pct / 100))
    const platformCents = Math.floor(totalCents * (rate.platform_pct / 100))
    const circleCents = totalCents - creatorCents - platformCents

    // Debit sender
    const { data: debitResult, error: debitErr } = await service.rpc('record_token_movement', {
      p_user_id: user.id,
      p_type: 'gift_sent',
      p_amount: -totalTokens,
      p_related_user: recipient_id,
      p_related_stream: stream_id ?? null,
      p_description: `Sent ${quantity}x ${gift.name} to creator`,
      p_metadata: { gift_id, gift_name: gift.name, quantity, stream_id: stream_id ?? null },
    })
    if (debitErr) {
      console.error('[send-gift] debit error:', debitErr)
      return NextResponse.json({ error: 'Failed to deduct tokens' }, { status: 500 })
    }

    // Credit recipient (token ledger entry)
    await service.rpc('record_token_movement', {
      p_user_id: recipient_id,
      p_type: 'gift_received',
      p_amount: 0,  // tokens don't go to creator — cash does
      p_related_user: user.id,
      p_related_stream: stream_id ?? null,
      p_description: `Received ${quantity}x ${gift.name} gift`,
      p_metadata: { gift_id, gift_name: gift.name, quantity, stream_id: stream_id ?? null, creator_cents: creatorCents },
    })

    // Credit creator wallet (atomic via wallet_add RPC)
    const month = new Date().toISOString().slice(0, 7) // '2026-07'

    const { error: walletAddErr } = await service.rpc('wallet_add', {
      p_creator_id: recipient_id,
      p_tokens: totalTokens,
      p_cents: creatorCents,
    })

    if (walletAddErr) {
      // Fallback: wallet_add migration not applied yet (function not found) —
      // use the legacy read-then-update path so credits are never dropped.
      console.error('[send-gift] wallet_add RPC failed, falling back to upsert:', walletAddErr)

      await service.rpc('ensure_creator_wallet', { p_creator_id: recipient_id })

      const { data: cw } = await service.from('creator_wallets').select('monthly_earnings, redeemable_cents, lifetime_earnings_cents, tokens_received').eq('creator_id', recipient_id).single()

      const monthly = (cw?.monthly_earnings ?? {}) as Record<string, Record<string, number>>
      monthly[month] = monthly[month] ?? { gifts: 0, challenges: 0, goals: 0, circle: 0 }
      monthly[month].gifts = (monthly[month].gifts ?? 0) + creatorCents

      await service.from('creator_wallets').update({
        tokens_received: (cw?.tokens_received ?? 0) + totalTokens,
        redeemable_cents: (cw?.redeemable_cents ?? 0) + creatorCents,
        lifetime_earnings_cents: (cw?.lifetime_earnings_cents ?? 0) + creatorCents,
        monthly_earnings: monthly,
        updated_at: new Date().toISOString(),
      }).eq('creator_id', recipient_id)
    }

    // Add to circle pool
    if (circleCents > 0) {
      const poolMonth = month
      const { data: pool } = await service.from('creator_circle_pool').select('id, total_cents').eq('month', poolMonth).single()
      if (pool) {
        await service.from('creator_circle_pool').update({ total_cents: pool.total_cents + circleCents }).eq('month', poolMonth)
      } else {
        await service.from('creator_circle_pool').insert({ month: poolMonth, total_cents: circleCents })
      }
    }

    // Record the gift transaction
    await service.from('live_gift_transactions').insert({
      sender_id: user.id,
      recipient_id,
      stream_id: stream_id ?? null,
      gift_id,
      quantity,
      total_tokens: totalTokens,
      creator_earned_cents: creatorCents,
      platform_fee_cents: platformCents,
      circle_pool_cents: circleCents,
    })

    return NextResponse.json({
      success: true,
      tokens_spent: totalTokens,
      new_balance: (debitResult as any)?.[0]?.new_balance ?? null,
      creator_earned_cents: creatorCents,
      gift: { name: gift.name, emoji: gift.emoji },
    })
  } catch (err) {
    console.error('[send-gift]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
