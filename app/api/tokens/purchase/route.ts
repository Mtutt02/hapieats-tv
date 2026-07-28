import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { checkRateLimit } from '@/lib/rate-limit'

// Legacy token bundle options (kept for backward compat with live page)
const TOKEN_BUNDLES: Record<string, { tokens: number; priceUsd: number; label: string }> = {
  starter: { tokens: 100, priceUsd: 1.99, label: '100 Tokens' },
  popular: { tokens: 500, priceUsd: 7.99, label: '500 Tokens (Best Value)' },
  mega: { tokens: 1200, priceUsd: 14.99, label: '1,200 Tokens' },
  ultra: { tokens: 3000, priceUsd: 29.99, label: '3,000 Tokens' },
}

export async function POST(req: NextRequest) {
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

  // Rate limit: max 10 token purchase sessions per user per 10 minutes
  const rl = checkRateLimit(`${user.id}:token_purchase`, 10, 10 * 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests — please wait before purchasing again.' }, { status: 429 })
  }

  const reqBody = await req.json()
  const { bundle, pack_id } = reqBody

  let tokenBundle: { tokens: number; priceUsd: number; label: string } | null = null
  let dbPackId: string | null = null

  // New: database-driven pack
  if (pack_id) {
    const service = createServiceClient()
    const { data: pack } = await service
      .from('token_packs')
      .select('*')
      .eq('id', pack_id)
      .eq('is_active', true)
      .single()
    if (!pack) return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    tokenBundle = {
      tokens: pack.token_amount + pack.bonus_tokens,
      priceUsd: pack.price_cents / 100,
      label: `${pack.name} — ${(pack.token_amount + pack.bonus_tokens).toLocaleString()} Hapi Tokens`,
    }
    dbPackId = pack.id
  } else {
    // Legacy bundle key
    tokenBundle = TOKEN_BUNDLES[bundle] ?? null
    if (!tokenBundle) return NextResponse.json({ error: 'Invalid bundle or pack_id required' }, { status: 400 })
  }

  // Validate redirect URLs — must be same origin to prevent open redirect
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://hapieatstv.com').replace(/\/$/, '')
  function safeRedirectUrl(url: string | undefined, fallback: string): string {
    if (!url) return fallback
    try {
      if (new URL(url).origin !== new URL(appOrigin).origin) return fallback
    } catch { return fallback }
    return url
  }
  const successUrl = safeRedirectUrl(reqBody.successUrl, `${appOrigin}/live?tokens=purchased`)
  const cancelUrl = safeRedirectUrl(reqBody.cancelUrl, `${appOrigin}/live`)

  // Get or create customer
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
    success_url: successUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/live?tokens=purchased`,
    cancel_url: cancelUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/live`,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(tokenBundle.priceUsd * 100),
          product_data: { name: tokenBundle.label },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: user.id,
      checkoutMode: 'token_purchase',
      tokenAmount: tokenBundle.tokens.toString(),
      ...(dbPackId ? { pack_id: dbPackId } : {}),
    },
  })

  return NextResponse.json({ url: session.url })
}

export async function GET() {
  return NextResponse.json(TOKEN_BUNDLES)
}
