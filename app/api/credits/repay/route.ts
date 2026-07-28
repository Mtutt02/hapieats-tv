/**
 * POST /api/credits/repay
 *
 * Manual loan repayment via Stripe.
 * Creates a Stripe checkout session for the full outstanding loan balance
 * (or a custom amount if provided).
 *
 * On webhook `checkout.session.completed` with checkoutMode: 'credits_repay',
 * the loan balance is reduced and a ledger entry is written.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { getCreditBalance } from '@/lib/credits'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`${user.id}:credit_repay`, 5, 10 * 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY ?? ''
  if (!stripeKey || stripeKey.length < 20 || stripeKey.includes('placeholder')) {
    return NextResponse.json({ error: 'Payments not configured' }, { status: 503 })
  }

  const body = await req.json()
  const { amountUsd, successUrl, cancelUrl } = body

  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://hapieatstv.com').replace(/\/$/, '')
  function safeUrl(url: string | undefined, fallback: string): string {
    if (!url) return fallback
    try {
      const parsed = new URL(url)
      if (parsed.origin !== new URL(appOrigin).origin) return fallback
    } catch { return fallback }
    return url
  }

  const balance = await getCreditBalance(user.id)
  if (balance.loanBalance <= 0) {
    return NextResponse.json({ error: 'No outstanding loan balance to repay' }, { status: 400 })
  }

  // If amount not provided, repay full outstanding loan
  const repayAmount = amountUsd
    ? Math.min(parseFloat(amountUsd), balance.loanBalance)
    : balance.loanBalance

  if (repayAmount <= 0) {
    return NextResponse.json({ error: 'Invalid repayment amount' }, { status: 400 })
  }

  const repayAmountCents = Math.round(repayAmount * 100)

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id
  if (!customerId) {
    const serviceClient = createServiceClient()
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await serviceClient.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    success_url: safeUrl(successUrl, `${appOrigin}/studio/credits?repaid=true`),
    cancel_url: safeUrl(cancelUrl, `${appOrigin}/studio/credits`),
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: repayAmountCents,
          product_data: {
            name: 'HapiEats TV — Credit Loan Repayment',
            description: `Repaying $${repayAmount.toFixed(2)} of your outstanding credit loan`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: user.id,
      checkoutMode: 'credits_repay',
      repayAmountUsd: repayAmount.toString(),
    },
  })

  return NextResponse.json({
    url: session.url,
    repayAmount,
    outstandingLoan: balance.loanBalance,
  })
}
