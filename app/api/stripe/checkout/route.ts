import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    // Guard: Stripe must be configured
    const stripeKey = process.env.STRIPE_SECRET_KEY ?? ''
    if (!stripeKey || stripeKey.length < 20 || stripeKey.includes('placeholder')) {
      return NextResponse.json({
        error: 'Payments are not configured yet — please contact support.',
        setup: true,
      }, { status: 503 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit: max 10 checkout sessions per user per 10 minutes
    const rl = checkRateLimit(`${user.id}:checkout`, 10, 10 * 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests — please wait before starting another checkout.' }, { status: 429 })
    }

    const body = await req.json()
    const {
      mode,
      videoId,
      channelId,
      videoTitle,
      priceInCents,
      stripePriceId,
      channelName,
    } = body

    // Validate redirect URLs — must be same origin to prevent open redirect on payment flow
    const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://hapieatstv.com').replace(/\/$/, '')
    function safeRedirectUrl(url: string | undefined, fallback: string): string {
      if (!url) return fallback
      try {
        const parsed = new URL(url)
        const allowed = new URL(appOrigin)
        if (parsed.origin !== allowed.origin) return fallback
      } catch { return fallback }
      return url
    }
    const successUrl = safeRedirectUrl(body.successUrl, `${appOrigin}/`)
    const cancelUrl = safeRedirectUrl(body.cancelUrl, `${appOrigin}/`)

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const baseParams = {
      customer: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: user.id,
        checkoutMode: mode,
        channelId: channelId ?? '',
        videoId: videoId ?? '',
      },
    }

    let session

    if (mode === 'creator_subscription') {
      if (!channelId) return NextResponse.json({ error: 'Missing channelId' }, { status: 400 })
      // Fetch stripe_price_id from DB — never trust client-supplied price ID
      const { data: channelRecord } = await supabase
        .from('channels')
        .select('stripe_price_id, name')
        .eq('id', channelId)
        .single()
      if (!channelRecord?.stripe_price_id) {
        return NextResponse.json({ error: 'Channel is not set up for subscriptions' }, { status: 400 })
      }
      session = await stripe.checkout.sessions.create({
        ...baseParams,
        mode: 'subscription',
        line_items: [{ price: channelRecord.stripe_price_id, quantity: 1 }],
        subscription_data: {
          metadata: { userId: user.id, channelId },
        },
      })
    } else if (mode === 'pay_per_view') {
      if (!videoId) return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })
      // Fetch price from DB — never trust client-supplied price
      const { data: videoRecord } = await supabase
        .from('videos')
        .select('title, price')
        .eq('id', videoId)
        .single()
      if (!videoRecord) return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      if (!videoRecord.price || videoRecord.price <= 0) {
        return NextResponse.json({ error: 'Video is not paid content' }, { status: 400 })
      }
      const serverPriceInCents = Math.round(videoRecord.price * 100)
      const serverTitle = videoRecord.title
      session = await stripe.checkout.sessions.create({
        ...baseParams,
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: serverPriceInCents,
              product_data: {
                name: serverTitle,
                metadata: { videoId },
              },
            },
            quantity: 1,
          },
        ],
      })
    } else if (mode === 'platform_subscription') {
      // Use price_data so this works without a pre-configured Stripe price ID.
      // Creator Pro: $14.99/month — unlocks live streaming + advanced features.
      session = await stripe.checkout.sessions.create({
        ...baseParams,
        mode: 'subscription',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: 1499, // $14.99
              recurring: { interval: 'month' },
              product_data: {
                name: 'HapiEats TV — Creator Pro',
                description: 'Live streaming, advanced analytics, priority support & more.',
              },
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: { userId: user.id, checkoutMode: 'platform_subscription' },
        },
      })
    } else {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
