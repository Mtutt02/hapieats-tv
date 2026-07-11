/**
 * POST /api/academy/pro/cancel
 *
 * Cancels the caller's HapiEats Pro subscription at period end.
 *   - Auth required.
 *   - Sets cancel_at_period_end on the Stripe subscription (keeps access
 *     until the paid period ends).
 *   - Marks pro_subscriptions.status = 'canceled' so status endpoints and
 *     access gates reflect the pending cancellation. Access itself remains
 *     until current_period_end (is_pro_member also honors that boundary).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payments not configured' }, { status: 503 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: sub } = await service
    .from('pro_subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', user.id)
    .single()

  if (!sub || !sub.stripe_subscription_id) {
    return NextResponse.json({ error: 'No active Pro subscription' }, { status: 404 })
  }

  try {
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    })
  } catch (err) {
    console.error('[academy/pro/cancel] stripe update error:', err)
    return NextResponse.json({ error: 'Could not cancel subscription' }, { status: 502 })
  }

  await service
    .from('pro_subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
