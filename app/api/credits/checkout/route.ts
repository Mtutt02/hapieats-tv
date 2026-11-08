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
import { randomUUID } from 'crypto'
import { paymentsPausedResponse } from '@/lib/payments-pause'

// Stripe only accepts expires_at between 30 minutes and 24 hours out. The shortest legal
// window keeps credits tied up as briefly as possible: when the session expires without
// payment (or the buyer cancels and walks away) the webhook gives the credits back.
const SESSION_TTL_SECONDS = 31 * 60

const CHECKOUT_FAILED = {
  error: 'We could not start checkout. Your credits were returned — please try again.',
}

export async function POST(req: NextRequest) {
  const paused = paymentsPausedResponse()
  if (paused) return paused
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

    // Already owned: never debit credits for something the buyer has (a double tap, or a
    // purchase that completed in another tab). Checked BEFORE the debit.
    const { data: owned, error: ownedErr } = await serviceClient
      .from('purchases')
      .select('video_id')
      .eq('buyer_id', user.id)
      .eq('video_id', videoId)
      .maybeSingle()
    if (ownedErr) {
      console.error('[credits/checkout] ownership check failed:', ownedErr)
      return NextResponse.json(CHECKOUT_FAILED, { status: 500 })
    }
    if (owned) {
      return NextResponse.json({ success: true, mode: 'already_owned', creditsUsed: 0, message: 'You already own this video.' })
    }

    const priceUsd = parseFloat(video.price)
    const creditBalance = await getCreditBalance(user.id)
    const application = calculateCreditApplication(priceUsd, creditBalance)

    if (application.totalCreditsUsed === 0) {
      // No credits to apply — tell caller to use standard Stripe checkout
      return NextResponse.json({ error: 'No credits available — use standard checkout' }, { status: 400 })
    }

    // Deduct credits first (atomic — any DB error throws before Stripe)
    const checkoutRef = randomUUID()
    const restore = (why: string) => restoreCredits(serviceClient, user.id, application, checkoutRef, why)
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
      const { error: unlockErr } = await serviceClient.from('purchases').upsert({
        buyer_id: user.id,
        video_id: videoId,
        stripe_payment_intent_id: null,
        amount: 0,
        credit_funded: true,
      }, { onConflict: 'buyer_id,video_id', ignoreDuplicates: true })
      if (unlockErr) {
        console.error('[credits/checkout] ppv unlock failed, restoring credits:', unlockErr)
        await restore('ppv unlock failed')
        return NextResponse.json(CHECKOUT_FAILED, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        mode: 'full_credit',
        creditsUsed: application.totalCreditsUsed,
        message: 'Video unlocked with credits!',
      })
    }

    // Partial — create Stripe session for the remainder
    const remainingCents = Math.round(application.remainingCash * 100)

    let session
    try {
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

      // idempotencyKey: if this call times out AFTER Stripe created the session, a retry of
      // the same checkoutRef returns that session instead of making a second one.
      session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'], // cards only: no delayed methods that complete unpaid
      expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
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
        checkoutRef, // the webhook restores under credit-checkout:<ref>:restore, same key as this route
        creditsUsed: application.totalCreditsUsed.toString(),
        giftUsed: application.giftUsed.toString(),
        loanUsed: application.loanUsed.toString(),
      },
    }, { idempotencyKey: checkoutRef })
    } catch (err) {
      // No Stripe session exists, so no webhook will ever come: give the credits back now.
      console.error('[credits/checkout] ppv session creation failed, restoring credits:', err)
      await restore('ppv checkout session failed')
      return NextResponse.json(CHECKOUT_FAILED, { status: 502 })
    }

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
    const checkoutRef = randomUUID()
    const restore = (why: string) => restoreCredits(serviceClient, user.id, application, checkoutRef, why)
    await deductCredits({
      userId: user.id,
      giftUsed: application.giftUsed,
      loanUsed: application.loanUsed,
      referenceId: packageId,
      referenceType: 'flavor',
      notes: `Credits applied to Flavor Points: ${pkg.name}`,
    })

    if (application.fullyCoveredByCredits) {
      // Credit wallet + purchase row in one transaction, once per checkout attempt
      const { error: creditErr } = await serviceClient.rpc('credit_flavor_once', {
        p_key: `credit-checkout:${checkoutRef}:flavor`,
        p_user_id: user.id,
        p_package_id: packageId,
        p_points: pkg.points,
        p_amount_usd: 0,
        p_session_id: null,
      })
      if (creditErr) {
        console.error('[credits/checkout] flavor credit failed, restoring credits:', creditErr)
        await restore('flavor credit failed')
        return NextResponse.json(CHECKOUT_FAILED, { status: 500 })
      }

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

    let session
    try {
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

      session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'], // cards only: no delayed methods that complete unpaid
      expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
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
        checkoutRef,
        creditsUsed: application.totalCreditsUsed.toString(),
        giftUsed: application.giftUsed.toString(),
        loanUsed: application.loanUsed.toString(),
      },
    }, { idempotencyKey: checkoutRef })
    } catch (err) {
      console.error('[credits/checkout] flavor session creation failed, restoring credits:', err)
      await restore('flavor checkout session failed')
      return NextResponse.json(CHECKOUT_FAILED, { status: 502 })
    }

    return NextResponse.json({
      success: false,
      mode: 'partial_credit',
      creditsUsed: application.totalCreditsUsed,
      remainingCash: application.remainingCash,
      stripeUrl: session.url,
    })
  }
}

/**
 * Give debited credits back, once per checkoutRef. The key is shared with the webhook
 * (checkout.session.expired / async_payment_failed), so whichever runs first restores and the
 * other is a no-op. Never throws: the caller is already on an error path. If the restore itself
 * fails, the problem is written to money_exceptions so someone reviews it (not just logged).
 */
async function restoreCredits(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  application: { giftUsed: number; loanUsed: number },
  checkoutRef: string,
  why: string,
) {
  const key = `credit-checkout:${checkoutRef}:restore`
  const { error } = await service.rpc('restore_credits_once', {
    p_key: key,
    p_user_id: userId,
    p_gift: application.giftUsed,
    p_loan: application.loanUsed,
    p_ref: checkoutRef,
    p_notes: `Credits returned: ${why}`,
  })
  if (!error) return

  console.error('[credits/checkout] CREDIT RESTORE FAILED — recording for manual review:', key, error)
  try {
    const { error: recordErr } = await service.from('money_exceptions').upsert(
      {
        dedupe_key: `credit-restore-failed:${checkoutRef}`,
        kind: 'credit_restore_failed',
        user_id: userId,
        ref: checkoutRef,
        amount: application.giftUsed + application.loanUsed,
        detail: { why, restore_key: key, gift: application.giftUsed, loan: application.loanUsed, error: error.message ?? String(error) },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'dedupe_key' },
    )
    if (recordErr) console.error('[credits/checkout] could not record the failed restore either:', recordErr)
  } catch (e) {
    console.error('[credits/checkout] could not record the failed restore either:', e)
  }
}
