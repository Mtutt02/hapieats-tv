import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { randomUUID } from 'crypto'

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

  const { giftId, streamId, requestId: clientRequestId } = await req.json()
  // One id per gift tap, reused by the client on retry: the same id is charged once.
  const requestId =
    typeof clientRequestId === 'string' && clientRequestId.length > 0 && clientRequestId.length <= 100
      ? clientRequestId
      : randomUUID()
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

  // Debit the sender, record the gift and credit the creator's earnings in ONE transaction
  // (send_flavor_gift). The sender's wallet row is locked, the balance can't go negative, and
  // the same (sender, request_id) is charged once even if the client submits twice.
  const { data: result, error: giftError } = await serviceClient.rpc('send_flavor_gift', {
    p_request_id:    requestId,
    p_sender_id:     user.id,
    p_creator_id:    creatorId,
    p_stream_id:     streamId,
    p_gift_id:       giftId,
    p_points_cost:   pointsCost,
    p_creator_share: creatorShare,
  })

  if (giftError) {
    if (giftError.message?.includes('INSUFFICIENT_BALANCE')) {
      return NextResponse.json({ error: 'Insufficient Flavor Points balance', code: 'insufficient_balance' }, { status: 402 })
    }
    console.error('[flavor/gift] send_flavor_gift error:', giftError)
    return NextResponse.json({ error: 'Could not send the gift — you were not charged.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    duplicate: result?.status === 'duplicate',
    gift: { id: giftId, name: gift.name, emoji: gift.emoji, pointsCost },
    newBalance: result?.new_balance,
  })
}
