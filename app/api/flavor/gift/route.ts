import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

// Gift catalog — cost in points
const GIFTS: Record<string, { name: string; emoji: string; pointsCost: number }> = {
  sauce_drop:     { name: 'Sauce Drop',     emoji: '🫙',   pointsCost: 5     },
  chopsticks:     { name: 'Chopsticks',     emoji: '🥢',   pointsCost: 10    },
  taco_pop:       { name: 'Taco Pop',       emoji: '🌮',   pointsCost: 25    },
  ramen_bowl:     { name: 'Ramen Bowl',     emoji: '🍜',   pointsCost: 50    },
  hapi_plate:     { name: 'Hapi Plate',     emoji: '🍽️',   pointsCost: 100   },
  bento_box:      { name: 'Bento Box',      emoji: '🍱',   pointsCost: 250   },
  hibachi_flame:  { name: 'Hibachi Flame',  emoji: '🔥',   pointsCost: 500   },
  chef_hat:       { name: 'Chef Hat',       emoji: '👨‍🍳',   pointsCost: 1000  },
  food_truck:     { name: 'Food Truck',     emoji: '🚚',   pointsCost: 5000  },
  golden_spatula: { name: 'Golden Spatula', emoji: '🥇',   pointsCost: 10000 },
}

// Creator gets 50% of gift point value
const CREATOR_SHARE = 0.5

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`${user.id}:flavor-gift`, 10, 60_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Too many gifts — slow down a moment.' }, { status: 429 })

  const { giftId, streamId } = await req.json()
  if (!giftId || !streamId) {
    return NextResponse.json({ error: 'giftId and streamId are required' }, { status: 400 })
  }

  const gift = GIFTS[giftId]
  if (!gift) return NextResponse.json({ error: 'Unknown gift' }, { status: 400 })

  const serviceClient = createServiceClient()

  // Look up creatorId server-side — never trust it from the client
  const { data: stream } = await serviceClient
    .from('live_streams')
    .select('creator_id, status')
    .eq('id', streamId)
    .single()

  if (!stream) return NextResponse.json({ error: 'Stream not found' }, { status: 404 })
  if (stream.status !== 'active') {
    return NextResponse.json({ error: 'Stream is not currently active' }, { status: 400 })
  }

  const creatorId = stream.creator_id
  if (user.id === creatorId) {
    return NextResponse.json({ error: 'You cannot gift yourself' }, { status: 400 })
  }

  const pointsCost = gift.pointsCost
  const creatorShare = Math.floor(pointsCost * CREATOR_SHARE)

  // 1. Check sender wallet
  const { data: wallet } = await serviceClient
    .from('flavor_wallets')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  if (!wallet || wallet.balance < pointsCost) {
    return NextResponse.json({ error: 'Insufficient Flavor Points balance', code: 'insufficient_balance' }, { status: 402 })
  }

  // 2. Deduct from sender wallet (optimistic lock: match balance so concurrent requests fail)
  const { error: deductError, data: deductResult } = await serviceClient
    .from('flavor_wallets')
    .update({ balance: wallet.balance - pointsCost, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('balance', wallet.balance) // optimistic lock — if balance changed, 0 rows updated
    .select('balance')

  if (deductError || !deductResult || deductResult.length === 0) {
    return NextResponse.json({ error: 'Balance changed — please retry' }, { status: 409 })
  }

  // Compensating refund — points were already debited, so any downstream
  // failure must return them or the sender loses Flavor Points for nothing.
  const refundSender = async () => {
    const { data: w } = await serviceClient
      .from('flavor_wallets').select('balance').eq('user_id', user.id).single()
    await serviceClient
      .from('flavor_wallets')
      .update({ balance: (w?.balance ?? 0) + pointsCost, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
  }

  // 3. Record gift event
  const { data: giftEvent, error: giftError } = await serviceClient
    .from('flavor_gift_events')
    .insert({
      stream_id: streamId,
      sender_id: user.id,
      creator_id: creatorId,
      gift_id: giftId,
      points_spent: pointsCost,
      creator_share: creatorShare,
    })
    .select('id')
    .single()

  if (giftError || !giftEvent) {
    await refundSender()
    return NextResponse.json({ error: 'Failed to record gift — your points were refunded.' }, { status: 500 })
  }

  // 4. Credit creator earnings — if this fails, roll back the gift event + refund
  const { error: earnError } = await serviceClient.from('creator_flavor_earnings').insert({
    creator_id: creatorId,
    gift_event_id: giftEvent.id,
    points_earned: creatorShare,
    status: 'pending',
  })

  if (earnError) {
    await serviceClient.from('flavor_gift_events').delete().eq('id', giftEvent.id)
    await refundSender()
    return NextResponse.json({ error: 'Failed to credit the creator — your points were refunded.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    gift: { id: giftId, name: gift.name, emoji: gift.emoji, pointsCost },
    newBalance: wallet.balance - pointsCost,
  })
}
