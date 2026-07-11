/**
 * POST /api/academy/pro/subscribe
 *
 * Starts a HapiEats Pro (all-access) subscription checkout.
 *   - Auth required.
 *   - If the user is already an active Pro member → { already: true } (no Stripe).
 *   - Otherwise create a Stripe Checkout Session in subscription mode at
 *     PRO_PRICE_USD/month. Uses NEXT_PUBLIC_STRIPE_PRO_PRICE_ID when set,
 *     else builds an inline monthly recurring price_data.
 *   - metadata.kind === 'pro_subscription' so the webhook can finalize via
 *     handleProCheckoutCompleted.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { isProMember } from '@/lib/academy/pro'
import { PRO_PRICE_USD } from '@/lib/academy/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payments not configured' }, { status: 503 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Already Pro? Do not double-subscribe.
  if (await isProMember(service, user.id)) {
    return NextResponse.json({ already: true })
  }

  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://hapieatstv.com').replace(/\/$/, '')

  // Reuse an existing Stripe customer if the profile has one.
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id as string | undefined
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  // Prefer a configured recurring price; otherwise build one inline.
  const configuredPrice = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
  const lineItem = configuredPrice
    ? { price: configuredPrice, quantity: 1 }
    : {
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(PRO_PRICE_USD * 100),
          recurring: { interval: 'month' as const },
          product_data: { name: 'HapiEats Pro — All-Access Membership' },
        },
        quantity: 1,
      }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [lineItem],
    success_url: `${appOrigin}/settings?pro=1`,
    cancel_url: `${appOrigin}/tokens`,
    metadata: { kind: 'pro_subscription', user_id: user.id },
    subscription_data: {
      metadata: { kind: 'pro_subscription', user_id: user.id },
    },
  })

  return NextResponse.json({ checkoutUrl: session.url })
}
