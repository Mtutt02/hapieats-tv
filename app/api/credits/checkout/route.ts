/**
 * POST /api/credits/checkout
 *
 * Credit-backed purchase flow. Handles:
 *   - mode: 'ppv'   → pay-per-view video unlock
 *   - mode: 'flavor' → Flavor Points package purchase
 *
 * Full credit cover → no Stripe, write to DB directly, return { success: true }
 * Partial credit cover → deduct credits immediately, create Stripe session
 *   for the remaining amount with metadata so the webhook can finalize.
 *
 * Payment routing:
 *   - Credits fund the purchase entirely from the platform balance.
 *   - Creator earns $0 from any credit-covered portion.
 *   - Only real Stripe cash in a partial purchase reaches the creator.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import {
  getCreditBalance,
  calculateCreditApplication,
  deductCredits,
} from '@/lib/credits'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`${user.id}:credit_checkout`, 20, 10 * 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests — please slow down.' }, { status: 429 })
  }

  const body = await req.json()
  const { mode, videoId, packageId, successUrl, cancelUrl } = body

  if (!['ppv', 'flavor'].includes(mode)) {
    return NextResponse.json({ error: 'Invalid mode — must be ppv or flavor' }, { status: 400 })
  }

  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://hapieatstv.com').replace(/\/$/, '')
  function safeUrl(url: string | undefined, fallback: string): string {
    if (!url) return fallback
    try {
      const parsed = new URL(url)
      if (parsed.origin !== new URL(appOrigin).origin) return fallback
    } catch { return fallback }
    return url
  }
  const safeSuccess = safeUrl(successUrl, `${appOrigin}/`)
  const safeCancel = safeUrl(cancelUrl, `${appOrigin}/`)

  const serviceClient = createServiceClient()

  // ── PPV mode ────────────────────────────────────────────────────────────────
  if (mode === 'ppv') {
    if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

    const { data: video } = await serviceClient
      .from('videos')
      .select('title, price')
      .eq('id', videoId)
      .single()

    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    if (!video.price || video.price <= 0) {
      return NextResponse.json({ error: 'Video is not paid content' }, { status: 400 })
    }

    const priceUsd = parseFloat(video.price)
    const creditBalance = await getCreditBalance(user.id)
    const application = calculateCreditApplication(priceUsd, creditBalance)

    if (application.totalCreditsUsed === 0) {
      // No credits to apply — tell caller to use standard Stripe checkout
      return NextResponse.json({ error: 'No credits available — use standard checkout' }, { status: 400 })
    }

    // Deduct credits first (atomic — any DB error throws before Stripe)
    await deductCredits({
      userId: user.id,
      giftUsed: application.giftUsed,
      loanUsed: application.loanUsed,
      referenceId: videoId,
      referenceType: 'ppv',
      notes: `Credits applied to PPV: ${video.title}`,
    })

    if (application.fullyCoveredByCredits) {
      // Unlock the video directly — no Stripe needed
      await serviceClient.from('purchases').upsert({
        buyer_id: user.id,
        video_id: videoId,
        stripe_payment_intent_id: null,
        amount: 0,
        credit_funded: true,
      }, { onConflict: 'buyer_id,video_id', ignoreDuplicates: true })

      return NextResponse.json({
        success: true,
        mode: 'full_credit',
        creditsUsed: application.totalCreditsUsed,
        message: 'Video unlocked with credits!',
      })
    }

    // Partial — create Stripe session for the remainder
    const remainingCents = Math.round(application.remainingCash * 100)

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
      success_url: safeSuccess,
      cancel_url: safeCancel,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: remainingCents,
            product_data: {
              name: video.title,
              description: `${application.totalCreditsUsed.toFixed(2)} in credits already applied`,
              metadata: { videoId },
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        checkoutMode: 'credit_ppv',
        videoId,
        creditsUsed: application.totalCreditsUsed.toString(),
        giftUsed: application.giftUsed.toString(),
        loanUsed: application.loanUsed.toString(),
      },
    })

    return NextResponse.json({
      success: false,
      mode: 'partial_credit',
      creditsUsed: application.totalCreditsUsed,
      remainingCash: application.remainingCash,
      stripeUrl: session.url,
    })
  }

  // ── Flavor Points mode ──────────────────────────────────────────────────────
  if (mode === 'flavor') {
    if (!packageId) return NextResponse.json({ error: 'packageId required' }, { status: 400 })

    const { data: pkg } = await serviceClient
      .from('flavor_packages')
      .select('id, name, points, price_usd')
      .eq('id', packageId)
      .single()

    if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 })

    const priceUsd = parseFloat(pkg.price_usd)
    const creditBalance = await getCreditBalance(user.id)
    const application = calculateCreditApplication(priceUsd, creditBalance)

    if (application.totalCreditsUsed === 0) {
      return NextResponse.json({ error: 'No credits available — use standard checkout' }, { status: 400 })
    }

    // Deduct credits atomically
    await deductCredits({
      userId: user.id,
      giftUsed: application.giftUsed,
      loanUsed: application.loanUsed,
      referenceId: packageId,
      referenceType: 'flavor',
      notes: `Credits applied to Flavor Points: ${pkg.name}`,
    })

    if (application.fullyCoveredByCredits) {
      // Credit wallet directly
      const { data: wallet } = await serviceClient
        .from('flavor_wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single()

      if (wallet) {
        await serviceClient
          .from('flavor_wallets')
          .update({ balance: wallet.balance + pkg.points, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
      } else {
        await serviceClient.from('flavor_wallets').insert({ user_id: user.id, balance: pkg.points })
      }

      await serviceClient.from('flavor_purchases').insert({
        user_id: user.id,
        package_id: packageId,
        points_credited: pkg.points,
        amount_usd: 0,
        stripe_session_id: null,
      })

      return NextResponse.json({
        success: true,
        mode: 'full_credit',
        creditsUsed: application.totalCreditsUsed,
        pointsCredited: pkg.points,
        message: `${pkg.points.toLocaleString()} Flavor Points added with credits!`,
      })
    }

    // Partial — create Stripe session for remainder
    const remainingCents = Math.round(application.remainingCash * 100)

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
      success_url: safeSuccess,
      cancel_url: safeCancel,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: remainingCents,
            product_data: {
              name: pkg.name,
              description: `${application.totalCreditsUsed.toFixed(2)} in credits already applied`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        checkoutMode: 'credit_flavor',
        packageId,
        pointsAmount: pkg.points.toString(),
        creditsUsed: application.totalCreditsUsed.toString(),
        giftUsed: application.giftUsed.toString(),
        loanUsed: application.loanUsed.toString(),
      },
    })

    return NextResponse.json({
      success: false,
      mode: 'partial_credit',
      creditsUsed: application.totalCreditsUsed,
      remainingCash: application.remainingCash,
      stripeUrl: session.url,
    })
  }
}
