import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { checkRateLimit } from '@/lib/rate-limit'

// Mirror of DB rows — kept in-code so checkout works even without a live DB read
const PACKAGES: Record<string, { name: string; points: number; priceUsd: number }> = {
  starter_bite: { name: 'Starter Bite',  points: 100,   priceUsd: 0.99  },
  snack_pack:   { name: 'Snack Pack',    points: 520,   priceUsd: 4.99  },
  full_plate:   { name: 'Full Plate',    points: 1100,  priceUsd: 9.99  },
  family_meal:  { name: 'Family Meal',   points: 2850,  priceUsd: 24.99 },
  feast_pack:   { name: 'Feast Pack',    points: 6000,  priceUsd: 49.99 },
  vip_table:    { name: 'VIP Table',     points: 12500, priceUsd: 99.99 },
}

export async function GET() {
  return NextResponse.json(PACKAGES)
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.STRIPE_SECRET_KEY ?? ''
    if (!key || key === 'sk_test_' || key.length < 20) {
      return NextResponse.json({
        error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to your Vercel environment variables.',
        setup: true,
      }, { status: 503 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit: max 10 flavor purchase sessions per user per 10 minutes
    const rl = checkRateLimit(`${user.id}:flavor_purchase`, 10, 10 * 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests — please wait before purchasing again.' }, { status: 429 })
    }

    const body = await req.json()
    const { packageId } = body
    const pkg = PACKAGES[packageId]
    if (!pkg) return NextResponse.json({ error: 'Invalid package' }, { status: 400 })

    // Validate redirect URLs — must be same origin to prevent open redirect
    const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://hapieatstv.com').replace(/\/$/, '')
    function safeRedirectUrl(url: string | undefined, fallback: string): string {
      if (!url) return fallback
      try {
        if (new URL(url).origin !== new URL(appOrigin).origin) return fallback
      } catch { return fallback }
      return url
    }
    const successUrl = safeRedirectUrl(body.successUrl, `${appOrigin}/flavor?success=1`)
    const cancelUrl = safeRedirectUrl(body.cancelUrl, `${appOrigin}/flavor`)

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
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(pkg.priceUsd * 100),
            product_data: {
              name: `${pkg.name} — ${pkg.points.toLocaleString()} Flavor Points`,
              description: 'HapiEats TV Flavor Points. Flavor Points have no cash value and are non-refundable.',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        checkoutMode: 'flavor_purchase',
        packageId,
        pointsAmount: pkg.points.toString(),
        priceUsd: pkg.priceUsd.toString(),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[flavor/purchase] Error:', err)
    return NextResponse.json({ error: 'Something went wrong — please try again.' }, { status: 500 })
  }
}
