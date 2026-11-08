import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { handleProCheckoutCompleted, handleProSubscriptionEvent } from '@/lib/academy/pro'
import {
  chargeInvoiceId,
  invoiceSubscriptionId,
  invoiceSubscriptionMetadata,
  invoiceTaxCents,
} from '@/lib/stripe-shapes'

export const runtime = 'nodejs'

const LEASE_SECONDS = 120

/** A failed write must fail the event so Stripe retries it. */
function must(error: { message?: string } | null | undefined, what: string) {
  if (error) throw new Error(`${what}: ${error.message ?? 'database error'}`)
}

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

  // NOTE: webhooks are deliberately NOT subject to PAYMENTS_PAUSED — in-flight
  // payments must still complete.
  const supabase = createServiceClient()

  // ── Two-phase event record ─────────────────────────────────────────────────
  // claim_stripe_event (see 20261107_money_fixes_833.sql) atomically returns:
  //   'claimed'   - we hold a 2 minute lease and must fulfil (new event, or a stale
  //                 'processing' row whose lease expired, i.e. a crashed delivery)
  //   'duplicate' - already completed: 200, nothing to do
  //   'busy'      - another delivery is mid-flight: 409 so Stripe retries later
  // Any other outcome (including a DB error) is a 500 — never "continue anyway".
  // The event is marked completed only after every side effect committed, and
  // every side effect below is idempotent on its own, so a retry (after a crash,
  // a lost response or a lease takeover) can never apply anything twice.
  const { data: claim, error: claimErr } = await supabase.rpc('claim_stripe_event', {
    p_id: event.id,
    p_type: event.type,
    p_lease_seconds: LEASE_SECONDS,
  })
  if (claimErr) {
    console.error('[stripe/webhook] claim_stripe_event failed:', claimErr)
    return NextResponse.json({ error: 'Could not record event' }, { status: 500 })
  }
  if (claim === 'duplicate') {
    console.log(`[stripe/webhook] duplicate event ${event.id} (${event.type}) — already completed, skipping`)
    return NextResponse.json({ received: true, duplicate: true })
  }
  if (claim === 'busy') {
    console.log(`[stripe/webhook] event ${event.id} (${event.type}) is being processed by another delivery`)
    return NextResponse.json({ error: 'Event in progress' }, { status: 409 })
  }
  if (claim !== 'claimed') {
    console.error('[stripe/webhook] unexpected claim result:', claim)
    return NextResponse.json({ error: 'Could not record event' }, { status: 500 })
  }

  try {
    switch (event.type) {
      // Fulfilment runs ONLY once the money is in. With a delayed payment method
      // (ACH / bank debit) `completed` arrives with payment_status 'unpaid'; the
      // buyer must not get the item then. `async_payment_succeeded` re-enters this
      // same path later (every effect below is idempotent), and
      // `async_payment_failed` goes to the restore case. 'no_payment_required' is
      // a zero-amount session (nothing to collect), so it fulfils immediately.
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
          console.log(`[stripe/webhook] ${event.type} ${session.id}: payment_status=${session.payment_status} — not fulfilling until paid`)
          break
        }
        const { userId, checkoutMode, videoId } = session.metadata ?? {}

        // HapiEats Pro all-access subscription
        if (session.metadata?.kind === 'pro_subscription') {
          await handleProCheckoutCompleted(supabase, session)
        }

        // Pay-per-view. Unique (buyer_id, video_id): a replay is a no-op.
        if (checkoutMode === 'pay_per_view' && videoId && userId) {
          const { error } = await supabase.from('purchases').upsert(
            {
              buyer_id: userId,
              video_id: videoId,
              stripe_payment_intent_id: session.payment_intent as string,
              amount: session.amount_total ?? 0,
            },
            { onConflict: 'buyer_id,video_id', ignoreDuplicates: true },
          )
          must(error, 'ppv purchase')
        }

        if (checkoutMode === 'platform_subscription' && userId) {
          const { error } = await supabase.from('profiles').update({
            platform_subscription_id: session.subscription as string,
            platform_subscription_status: 'active',
          }).eq('id', userId)
          must(error, 'platform subscription')
        }

        // Token purchase — wallet credit + ledger + legacy mirror in ONE transaction,
        // keyed by the Stripe session so it can only ever apply once.
        if (checkoutMode === 'token_purchase' && userId) {
          const tokenAmount = parseInt(session.metadata?.tokenAmount ?? '0', 10)
          if (tokenAmount > 0) {
            const { error } = await supabase.rpc('credit_tokens_once', {
              p_key: `stripe:session:${session.id}:tokens`,
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
            must(error, 'token credit')

            // Check if this purchase crosses the auto-unlock threshold for creator monetization.
            // Idempotent and non-critical.
            try {
              await supabase.rpc('check_monetization_auto_unlock', { p_user_id: userId })
            } catch { /* ignore */ }
          }
        }

        // Class enrollment — unique (class_id, user_id)
        if (checkoutMode === 'class_enrollment' && userId) {
          const classId = session.metadata?.classId ?? ''
          if (classId) {
            const { error } = await supabase.from('class_enrollments').upsert(
              { class_id: classId, user_id: userId, status: 'active' },
              { onConflict: 'class_id,user_id', ignoreDuplicates: true },
            )
            must(error, 'class enrollment')
          }
        }

        // Course enrollment — unique (course_id, user_id) (index added by the 20261107 migration; the
        // upsert needs it). With ignoreDuplicates the
        // upsert returns only rows it actually inserted, so the counter moves once.
        if (checkoutMode === 'course_enrollment' && userId) {
          const courseId = session.metadata?.courseId ?? ''
          const priceUsd = parseFloat(session.metadata?.priceUsd ?? '0')
          if (courseId) {
            const { data: inserted, error: enrollErr } = await supabase
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
              .select('course_id')
            must(enrollErr, 'course enrollment')

            // Atomic counter bump (bump_course_enrollment), not read-then-write. Only the
            // delivery that actually inserted the enrollment row bumps it.
            if (inserted && inserted.length > 0) {
              const { error: bumpErr } = await supabase.rpc('bump_course_enrollment', { p_course_id: courseId })
              must(bumpErr, 'course enrollment_count')
            }
          }
        }

        // Academy program enrollment — unique (program_id, user_id)
        if (checkoutMode === 'program_enrollment' && userId) {
          const programId = session.metadata?.programId ?? ''
          if (programId) {
            const { error } = await supabase
              .from('program_enrollments')
              .upsert(
                { program_id: programId, user_id: userId, status: 'active' },
                { onConflict: 'program_id,user_id', ignoreDuplicates: true },
              )
            must(error, 'program enrollment')
          } else {
            console.error('[webhook] program_enrollment with no programId in metadata', session.id)
          }
        }

        // Flavor Points purchase (cash, or the cash part of a partial-credit purchase).
        // Wallet + purchase row commit together, once per Stripe session.
        if ((checkoutMode === 'flavor_purchase' || checkoutMode === 'credit_flavor') && userId) {
          const pointsAmount = parseInt(session.metadata?.pointsAmount ?? '0', 10)
          const packageId = session.metadata?.packageId ?? ''
          if (pointsAmount > 0 && (checkoutMode === 'flavor_purchase' || packageId)) {
            const { error } = await supabase.rpc('credit_flavor_once', {
              p_key: `stripe:session:${session.id}:flavor`,
              p_user_id: userId,
              p_package_id: packageId,
              p_points: pointsAmount,
              p_amount_usd: (session.amount_total ?? 0) / 100,
              p_session_id: session.id,
            })
            must(error, 'flavor credit')
          }
        }

        // Partial-credit PPV (credits were deducted at checkout time): finalize the
        // purchase row. Unique (buyer_id, video_id).
        if (checkoutMode === 'credit_ppv' && userId) {
          const creditVideoId = session.metadata?.videoId ?? ''
          if (creditVideoId) {
            const { error } = await supabase.from('purchases').upsert(
              {
                buyer_id: userId,
                video_id: creditVideoId,
                stripe_payment_intent_id: session.payment_intent as string,
                amount: session.amount_total ?? 0,
                credit_funded: true,
              },
              { onConflict: 'buyer_id,video_id', ignoreDuplicates: true },
            )
            must(error, 'credit ppv purchase')
            console.log(`[webhook] credit_ppv unlocked video ${creditVideoId} for user ${userId}`)
          }
        }

        // Manual credit loan repayment — once per Stripe session
        if (checkoutMode === 'credits_repay' && userId) {
          const repayAmount = parseFloat(session.metadata?.repayAmountUsd ?? '0')
          if (repayAmount > 0) {
            const { data: applied, error } = await supabase.rpc('repay_loan_once', {
              p_key: `stripe:session:${session.id}:repay`,
              p_user_id: userId,
              p_amount: repayAmount,
              p_session_id: session.id,
            })
            must(error, 'loan repayment')
            console.log(`[webhook] credits_repay: user ${userId} repaid $${Number(applied ?? 0).toFixed(2)}`)
          }
        }
        break
      }

      // ── Abandoned / failed partial-credit checkout: give the credits back ─────
      // /api/credits/checkout debits credits BEFORE creating the Stripe session. If
      // the session expires (we create them with a 30 minute expiry) or an async
      // payment fails, the cash part will never arrive, so the credits go back.
      // Keyed by session id: expired + async_payment_failed + any replay restore once.
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session
        const { userId, checkoutMode } = session.metadata ?? {}
        if ((checkoutMode === 'credit_ppv' || checkoutMode === 'credit_flavor') && userId) {
          const gift = Number(session.metadata?.giftUsed ?? 0) || 0
          const loan = Number(session.metadata?.loanUsed ?? 0) || 0
          if (gift > 0 || loan > 0) {
            const { error } = await supabase.rpc('restore_credits_once', {
              p_key: `stripe:session:${session.id}:credit-restore`,
              p_user_id: userId,
              p_gift: gift,
              p_loan: loan,
              p_ref: session.id,
              p_notes: `Credits returned: checkout ${event.type === 'checkout.session.expired' ? 'expired' : 'payment failed'} (${session.id})`,
            })
            must(error, 'credit restore')
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
          const { error } = await supabase.from('subscriptions').upsert({
            subscriber_id: userId,
            channel_id: channelId,
            stripe_subscription_id: sub.id,
            status: sub.status,
            current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
          }, { onConflict: 'stripe_subscription_id' })
          must(error, 'channel subscription')
        } else if (sub.metadata?.kind !== 'pro_subscription') {
          // Platform subscription — update profile. A Pro subscription has no channelId
          // but is NOT the platform subscription: it is handled by handleProSubscriptionEvent.
          const customer = await stripe.customers.retrieve(sub.customer as string)
          if (!('deleted' in customer)) {
            const { error } = await supabase.from('profiles').update({
              platform_subscription_id: sub.id,
              platform_subscription_status: sub.status,
            }).eq('stripe_customer_id', sub.customer as string)
            must(error, 'platform subscription status')
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
          const { error } = await supabase.from('subscriptions')
            .update({ status: 'canceled' })
            .eq('stripe_subscription_id', sub.id)
          must(error, 'channel subscription cancel')
        } else if (sub.metadata?.kind !== 'pro_subscription') {
          const { error } = await supabase.from('profiles').update({
            platform_subscription_status: 'canceled',
          }).eq('stripe_customer_id', sub.customer as string)
          must(error, 'platform subscription cancel')
        }
        break
      }

      // ── Pro subscription invoice paid: record REAL revenue for the creator pool ──
      // pro_revenue_ledger is the only input to the monthly payout's gross. Keyed
      // by invoice id, so a replay (or two event ids for one invoice) records once.
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        // Field locations differ by the endpoint's API version: lib/stripe-shapes reads both.
        const subId = invoiceSubscriptionId(invoice)
        const subMeta = invoiceSubscriptionMetadata(invoice)
        let isPro = subMeta.kind === 'pro_subscription'
        if (!isPro && subId) {
          const { data: proRow, error } = await supabase
            .from('pro_subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', subId)
            .maybeSingle()
          must(error, 'pro subscription lookup')
          isPro = !!proRow
        }
        const collected = (invoice.amount_paid ?? 0) - invoiceTaxCents(invoice)
        if (isPro && invoice.id && collected > 0) {
          const paidAtSec = invoice.status_transitions?.paid_at ?? invoice.created
          const paidAt = new Date(paidAtSec * 1000)
          const { error } = await supabase.from('pro_revenue_ledger').upsert(
            {
              stripe_invoice_id: invoice.id,
              user_id: subMeta.user_id ?? null,
              stripe_subscription_id: subId,
              amount_cents: collected,
              currency: invoice.currency ?? 'usd',
              paid_at: paidAt.toISOString(),
              month: paidAt.toISOString().slice(0, 7),
            },
            { onConflict: 'stripe_invoice_id', ignoreDuplicates: true },
          )
          must(error, 'pro revenue ledger')
        }
        break
      }

      // ── Invoice payment failed ────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const failedSubId = invoiceSubscriptionId(invoice)
        if (failedSubId) {
          const { error } = await supabase.from('subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', failedSubId)
          must(error, 'invoice payment failed')
        }
        break
      }

      // ── Refund / chargeback — claw back token credits ─────────────────────────
      // Token purchases are keyed by PAYMENT, not by event: a refund plus a dispute
      // on one charge, or two partial refunds, are several events for one purchase.
      // reverse_tokens_for_payment keeps one row per payment intent with cumulative
      // refund / dispute targets (proportional to amount_refunded / amount, capped at
      // what was bought), so no sequence of events can ever reverse more than the
      // buyer got, and a replay changes nothing. If the buyer already spent some of
      // it, the available balance is clawed back and the shortfall lands in
      // money_exceptions for manual review (written inside the same function).
      case 'charge.refunded':
      case 'charge.dispute.created': {
        const isDispute = event.type === 'charge.dispute.created'
        const reason = isDispute ? 'chargeback' : 'refund'
        const charge = isDispute ? null : (event.data.object as Stripe.Charge)
        const dispute = isDispute ? (event.data.object as Stripe.Dispute) : null

        // A refunded / disputed Pro invoice shrinks that month's pool. Absolute
        // amounts from Stripe, so replays are harmless.
        const ledgerCharge: Stripe.Charge | null = charge
          ?? (dispute?.charge
            ? (typeof dispute.charge === 'string' ? await stripe.charges.retrieve(dispute.charge) : dispute.charge)
            : null)
        const chargeInvoice = ledgerCharge ? await chargeInvoiceId(stripe, ledgerCharge) : null
        if (chargeInvoice) {
          const patch = isDispute
            ? { disputed_cents: Number(dispute?.amount ?? 0) }
            : { refunded_cents: charge?.amount_refunded ?? 0 }
          const { error } = await supabase
            .from('pro_revenue_ledger')
            .update(patch)
            .eq('stripe_invoice_id', chargeInvoice)
          must(error, 'pro revenue refund/dispute')
        }

        const paymentIntentId = isDispute
          ? ((dispute!.payment_intent as string | null) ?? null)
          : (charge!.payment_intent as string | null)

        if (!paymentIntentId) {
          console.error(`[stripe/webhook] ${event.type}: no payment_intent on event ${event.id} — skipping`)
          break
        }

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
            // Share of the purchase this event covers, as tokens (floor; a full refund is exact).
            const paid = Number(charge?.amount ?? session.amount_total ?? 0)
            const covered = isDispute ? Number(dispute?.amount ?? 0) : Number(charge?.amount_refunded ?? 0)
            const fullyCovered = isDispute
              ? !(paid > 0) || covered >= paid
              : charge?.refunded === true || (paid > 0 && covered >= paid)
            const sourceTokens = fullyCovered
              ? tokenAmount
              : Math.min(tokenAmount, Math.floor((tokenAmount * covered) / paid))

            const { data: rev, error: reverseErr } = await supabase.rpc('reverse_tokens_for_payment', {
              p_key: `stripe:pi:${paymentIntentId}:token-reversal`,
              p_user_id: userId,
              p_purchased: tokenAmount,
              p_source: isDispute ? 'dispute' : 'refund',
              p_source_tokens: sourceTokens,
              p_reason: reason,
              p_metadata: {
                reason,
                stripe_event_id: event.id,
                stripe_session_id: session.id,
                stripe_payment_intent_id: paymentIntentId,
              },
            })
            must(reverseErr, 'token reversal')
            if (rev?.shortfall > 0) {
              // The buyer already spent part of it; retrying cannot help. The function
              // clawed back what was available and recorded the rest in money_exceptions.
              console.error(`[stripe/webhook] ${event.type}: ${rev.shortfall} tokens not recoverable from ${userId} (already spent) — see money_exceptions`)
            }
            console.log(`[stripe/webhook] ${event.type}: reversed ${rev?.reversed_now ?? 0} tokens for user ${userId} (${reason}); ${rev?.reversed_total ?? 0}/${tokenAmount} total`)
          }
        } else {
          console.log(`[stripe/webhook] ${event.type}: session ${session.id} is checkoutMode=${checkoutMode ?? 'unknown'} — no token reversal applicable`)
        }
        break
      }
    }

    const { error: doneErr } = await supabase.rpc('complete_stripe_event', { p_id: event.id })
    must(doneErr, 'complete_stripe_event')
  } catch (err) {
    // Fulfilment failed. Hand the lease back so Stripe's retry runs the event again
    // immediately. The row stays 'processing' (never 'completed'), and if even this
    // release fails the lease simply expires on its own and the retry takes over.
    console.error(`[stripe/webhook] ${event.type} ${event.id} failed, releasing lease for retry:`, err)
    const { error: releaseErr } = await supabase.rpc('release_stripe_event', { p_id: event.id })
    if (releaseErr) console.error('[stripe/webhook] could not release lease (will expire):', releaseErr)
    return NextResponse.json({ error: 'Fulfilment failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
