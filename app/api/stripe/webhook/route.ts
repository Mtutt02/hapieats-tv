import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { getCreditBalance } from '@/lib/credits'
import { handleProCheckoutCompleted, handleProSubscriptionEvent } from '@/lib/academy/pro'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = headers().get('stripe-signature')

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  let event: Stripe.Event

  if (!webhookSecret || webhookSecret.length < 10) {
    // Stripe webhook secret is required — refuse the request rather than
    // accepting unverified events. Set STRIPE_WEBHOOK_SECRET in Vercel env vars.
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET not configured — rejecting request')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  try {
    event = stripe.webhooks.constructEvent(body, sig ?? '', webhookSecret)
  } catch (err) {
    console.error('[stripe/webhook] signature error:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // ── Idempotency guard ──────────────────────────────────────────────────────
  // Record the event id in stripe_events. A unique-violation (23505) means
  // Stripe retried an event we already processed — acknowledge with 200 and
  // do nothing. Any OTHER insert error (table missing pre-migration, transient
  // DB issue) must never block processing: log and continue.
  try {
    const { error: idempotencyErr } = await supabase
      .from('stripe_events')
      .insert({ id: event.id, type: event.type })

    if (idempotencyErr) {
      if (idempotencyErr.code === '23505') {
        console.log(`[stripe/webhook] duplicate event ${event.id} (${event.type}) — already processed, skipping`)
        return NextResponse.json({ received: true, duplicate: true })
      }
      console.error('[stripe/webhook] stripe_events insert error (continuing):', idempotencyErr)
    }
  } catch (err) {
    console.error('[stripe/webhook] stripe_events guard threw (continuing):', err)
  }

  switch (event.type) {
    // ── Pay-per-view completed ────────────────────────────────────────────────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const { userId, checkoutMode, videoId, channelId } = session.metadata ?? {}

      // HapiEats Pro all-access subscription
      if (session.metadata?.kind === 'pro_subscription') {
        await handleProCheckoutCompleted(supabase, session)
      }

      if (checkoutMode === 'pay_per_view' && videoId && userId) {
        await supabase.from('purchases').upsert({
          buyer_id: userId,
          video_id: videoId,
          stripe_payment_intent_id: session.payment_intent as string,
          amount: session.amount_total ?? 0,
        })
      }

      if (checkoutMode === 'platform_subscription' && userId) {
        await supabase.from('profiles').update({
          platform_subscription_id: session.subscription as string,
          platform_subscription_status: 'active',
        }).eq('id', userId)
      }

      // Token purchase — credit hapi_tokens wallet + ledger
      if (checkoutMode === 'token_purchase' && userId) {
        const tokenAmount = parseInt(session.metadata?.tokenAmount ?? '0', 10)
        if (tokenAmount > 0) {
          // Use new hapi_tokens table (upsert wallet, record ledger)
          const { error: walletErr } = await supabase.rpc('record_token_movement', {
            p_user_id: userId,
            p_type: 'purchase',
            p_amount: tokenAmount,
            p_description: `Purchased ${tokenAmount} Hapi Tokens`,
            p_metadata: {
              stripe_session_id: session.id,
              pack_id: session.metadata?.pack_id ?? null,
              amount_cents: session.amount_total ?? 0,
            },
          })
          if (walletErr) {
            console.error('[webhook] hapi_tokens credit error:', walletErr)
            // Fallback: direct upsert
            const { data: existing } = await supabase
              .from('hapi_tokens')
              .select('balance')
              .eq('user_id', userId)
              .single()
            if (existing) {
              await supabase.from('hapi_tokens')
                .update({ balance: existing.balance + tokenAmount, lifetime_purchased: existing.balance + tokenAmount, updated_at: new Date().toISOString() })
                .eq('user_id', userId)
            } else {
              await supabase.from('hapi_tokens')
                .insert({ user_id: userId, balance: tokenAmount, lifetime_purchased: tokenAmount })
            }
          }

          // Also keep legacy token_balances table in sync (backward compat)
          try {
            const { data: legacyWallet } = await supabase
              .from('token_balances')
              .select('balance')
              .eq('user_id', userId)
              .single()
            if (legacyWallet) {
              await supabase.from('token_balances')
                .update({ balance: legacyWallet.balance + tokenAmount })
                .eq('user_id', userId)
            } else {
              await supabase.from('token_balances').insert({ user_id: userId, balance: tokenAmount })
            }
          } catch { /* legacy table may not exist — ignore */ }

          // Check if this purchase crosses the auto-unlock threshold for creator monetization
          try {
            await supabase.rpc('check_monetization_auto_unlock', { p_user_id: userId })
          } catch { /* non-critical — ignore */ }
        }
      }

      // Class enrollment — grant access after payment
      if (checkoutMode === 'class_enrollment' && userId) {
        const classId = session.metadata?.classId ?? ''
        if (classId) {
          await supabase.from('class_enrollments').upsert(
            { class_id: classId, user_id: userId, status: 'active' },
            { onConflict: 'class_id,user_id', ignoreDuplicates: true }
          )
        }
      }

      // Course enrollment — grant access after payment
      if (checkoutMode === 'course_enrollment' && userId) {
        const courseId = session.metadata?.courseId ?? ''
        const priceUsd = parseFloat(session.metadata?.priceUsd ?? '0')
        if (courseId) {
          // Upsert enrollment
          const { error: enrollErr } = await supabase
            .from('course_enrollments')
            .upsert(
              {
                course_id: courseId,
                user_id: userId,
                amount_paid_usd: priceUsd,
                stripe_session_id: session.id,
              },
              { onConflict: 'course_id,user_id', ignoreDuplicates: true },
            )

          if (!enrollErr) {
            // Increment enrollment_count
            const { data: course } = await supabase
              .from('courses')
              .select('enrollment_count')
              .eq('id', courseId)
              .single()
            if (course) {
              await supabase
                .from('courses')
                .update({ enrollment_count: (course.enrollment_count ?? 0) + 1 })
                .eq('id', courseId)
            }
          } else {
            console.error('[webhook] course_enrollment upsert error:', enrollErr)
          }
        }
      }

      // Flavor Points purchase — credit flavor wallet
      if (checkoutMode === 'flavor_purchase' && userId) {
        const pointsAmount = parseInt(session.metadata?.pointsAmount ?? '0', 10)
        const packageId = session.metadata?.packageId ?? ''
        if (pointsAmount > 0) {
          const amountUsd = (session.amount_total ?? 0) / 100

          // Upsert flavor wallet
          const { data: existing } = await supabase
            .from('flavor_wallets')
            .select('balance')
            .eq('user_id', userId)
            .single()

          if (existing) {
            await supabase
              .from('flavor_wallets')
              .update({ balance: existing.balance + pointsAmount, updated_at: new Date().toISOString() })
              .eq('user_id', userId)
          } else {
            await supabase
              .from('flavor_wallets')
              .insert({ user_id: userId, balance: pointsAmount })
          }

          // Record purchase
          await supabase.from('flavor_purchases').insert({
            user_id: userId,
            package_id: packageId,
            points_credited: pointsAmount,
            amount_usd: amountUsd,
            stripe_session_id: session.id,
          })
        }
      }

      // ── Partial-credit PPV (credits already deducted at checkout time) ──────
      // The credit deduction already happened in /api/credits/checkout.
      // Here we just finalize the purchase row with the Stripe payment info.
      if (checkoutMode === 'credit_ppv' && userId) {
        const videoId = session.metadata?.videoId ?? ''
        if (videoId) {
          await supabase.from('purchases').upsert(
            {
              buyer_id: userId,
              video_id: videoId,
              stripe_payment_intent_id: session.payment_intent as string,
              amount: session.amount_total ?? 0,
              credit_funded: true,
            },
            { onConflict: 'buyer_id,video_id', ignoreDuplicates: true },
          )
          console.log(`[webhook] credit_ppv unlocked video ${videoId} for user ${userId}`)
        }
      }

      // ── Partial-credit Flavor Points purchase ─────────────────────────────
      if (checkoutMode === 'credit_flavor' && userId) {
        const packageId = session.metadata?.packageId ?? ''
        const pointsAmount = parseInt(session.metadata?.pointsAmount ?? '0', 10)
        if (packageId && pointsAmount > 0) {
          const amountUsd = (session.amount_total ?? 0) / 100

          const { data: wallet } = await supabase
            .from('flavor_wallets')
            .select('balance')
            .eq('user_id', userId)
            .single()

          if (wallet) {
            await supabase
              .from('flavor_wallets')
              .update({ balance: wallet.balance + pointsAmount, updated_at: new Date().toISOString() })
              .eq('user_id', userId)
          } else {
            await supabase.from('flavor_wallets').insert({ user_id: userId, balance: pointsAmount })
          }

          await supabase.from('flavor_purchases').insert({
            user_id: userId,
            package_id: packageId,
            points_credited: pointsAmount,
            amount_usd: amountUsd,
            stripe_session_id: session.id,
          })
        }
      }

      // ── Manual credit loan repayment ─────────────────────────────────────
      if (checkoutMode === 'credits_repay' && userId) {
        const repayAmount = parseFloat(session.metadata?.repayAmountUsd ?? '0')
        if (repayAmount > 0) {
          // Re-fetch balance to ensure we don't over-reduce
          const bal = await getCreditBalance(userId)
          const actualRepay = Math.min(repayAmount, bal.loanBalance)

          if (actualRepay > 0) {
            const newLoan = Math.round((bal.loanBalance - actualRepay) * 100) / 100
            const newRepaid = Math.round((bal.loanRepaid + actualRepay) * 100) / 100

            await supabase
              .from('app_credits')
              .update({ loan_balance: newLoan, loan_repaid: newRepaid })
              .eq('user_id', userId)

            await supabase.from('credit_ledger').insert({
              user_id: userId,
              entry_type: 'repay_loan_manual',
              amount: actualRepay,
              gift_balance_after: bal.giftBalance,
              loan_balance_after: newLoan,
              reference_id: session.id,
              reference_type: 'stripe_repay',
              notes: `Manual repayment via Stripe session ${session.id}`,
            })

            console.log(`[webhook] credits_repay: user ${userId} repaid $${actualRepay.toFixed(2)}, new loan balance $${newLoan}`)
          }
        }
      }
      break
    }

    // ── Creator channel subscription created/updated ──────────────────────────
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const { userId, channelId } = sub.metadata

      // HapiEats Pro all-access subscription state changes
      if (sub.metadata?.kind === 'pro_subscription') {
        await handleProSubscriptionEvent(supabase, sub)
      }

      if (userId && channelId) {
        await supabase.from('subscriptions').upsert({
          subscriber_id: userId,
          channel_id: channelId,
          stripe_subscription_id: sub.id,
          status: sub.status,
          current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
        }, { onConflict: 'stripe_subscription_id' })
      } else {
        // Platform subscription — update profile
        const customer = await stripe.customers.retrieve(sub.customer as string)
        if (!('deleted' in customer)) {
          await supabase.from('profiles').update({
            platform_subscription_id: sub.id,
            platform_subscription_status: sub.status,
          }).eq('stripe_customer_id', sub.customer as string)
        }
      }
      break
    }

    // ── Subscription cancelled ────────────────────────────────────────────────
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const { userId, channelId } = sub.metadata

      if (sub.metadata?.kind === 'pro_subscription') {
        await handleProSubscriptionEvent(supabase, sub)
      }

      if (userId && channelId) {
        await supabase.from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', sub.id)
      } else {
        await supabase.from('profiles').update({
          platform_subscription_status: 'canceled',
        }).eq('stripe_customer_id', sub.customer as string)
      }
      break
    }

    // ── Invoice payment failed ────────────────────────────────────────────────
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.subscription) {
        await supabase.from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', invoice.subscription as string)
      }
      break
    }

    // ── Refund / chargeback — claw back token credits ─────────────────────────
    // Token purchases record the Stripe session in token_ledger metadata
    // (stripe_session_id, set in the token_purchase branch above). We map
    // charge → payment_intent → checkout session, read the session metadata
    // that the checkout flow stored (checkoutMode, userId, tokenAmount), and
    // reverse the credit via record_token_movement. If the original purchase
    // can't be located we log and still return 200 — never 500 to Stripe.
    case 'charge.refunded':
    case 'charge.dispute.created': {
      try {
        const isDispute = event.type === 'charge.dispute.created'
        const reason = isDispute ? 'chargeback' : 'refund'

        const paymentIntentId = isDispute
          ? ((event.data.object as Stripe.Dispute).payment_intent as string | null)
          : ((event.data.object as Stripe.Charge).payment_intent as string | null)

        if (!paymentIntentId) {
          console.error(`[stripe/webhook] ${event.type}: no payment_intent on event ${event.id} — skipping`)
          break
        }

        // Locate the original checkout session for this payment intent
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: paymentIntentId,
          limit: 1,
        })
        const session = sessions.data[0]

        if (!session) {
          console.error(`[stripe/webhook] ${event.type}: no checkout session for payment_intent ${paymentIntentId} — skipping`)
          break
        }

        const { userId, checkoutMode } = session.metadata ?? {}

        if (checkoutMode === 'token_purchase' && userId) {
          const tokenAmount = parseInt(session.metadata?.tokenAmount ?? '0', 10)
          if (tokenAmount > 0) {
            // Negative movement reverses the purchase credit. token_ledger's
            // type CHECK only allows 'refund' — the chargeback distinction is
            // preserved in the description + metadata.reason.
            const { error: reverseErr } = await supabase.rpc('record_token_movement', {
              p_user_id: userId,
              p_type: 'refund',
              p_amount: -tokenAmount,
              p_description: `Reversed ${tokenAmount} Hapi Tokens (${reason})`,
              p_metadata: {
                reason,
                stripe_event_id: event.id,
                stripe_session_id: session.id,
                stripe_payment_intent_id: paymentIntentId,
              },
            })
            if (reverseErr) {
              console.error(`[stripe/webhook] ${event.type}: token reversal failed for user ${userId}:`, reverseErr)
            } else {
              console.log(`[stripe/webhook] ${event.type}: reversed ${tokenAmount} tokens for user ${userId} (${reason})`)
            }
          }
        } else {
          console.log(`[stripe/webhook] ${event.type}: session ${session.id} is checkoutMode=${checkoutMode ?? 'unknown'} — no token reversal applicable`)
        }
      } catch (err) {
        // Never bubble a 500 back to Stripe for refund/dispute handling
        console.error(`[stripe/webhook] ${event.type} handler error (returning 200):`, err)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
