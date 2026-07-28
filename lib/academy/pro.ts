// ============================================================
// HapiEats Pro — subscription helpers + Stripe webhook handlers.
//
// Pure functions: each takes a Supabase service-role client and
// the relevant Stripe object. Nothing here reaches into request
// context, so the webhook route can import + call these directly.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'

/** True if the user has an active/trialing Pro subscription. Delegates to the is_pro_member RPC. */
export async function isProMember(service: SupabaseClient, userId: string): Promise<boolean> {
  if (!userId) return false
  const { data, error } = await service.rpc('is_pro_member', { p_user_id: userId })
  if (error) {
    console.error('[academy/pro] is_pro_member RPC error:', error)
    return false
  }
  return data === true
}

function periodToIso(sec: number | null | undefined): string | null {
  if (!sec || typeof sec !== 'number') return null
  return new Date(sec * 1000).toISOString()
}

/**
 * checkout.session.completed handler for Pro.
 * Only acts on sessions whose metadata.kind === 'pro_subscription'.
 * Upserts pro_subscriptions to active, recording Stripe ids + billing period.
 */
export async function handleProCheckoutCompleted(
  service: SupabaseClient,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const meta = session.metadata ?? {}
  if (meta.kind !== 'pro_subscription') return

  const userId = meta.user_id
  if (!userId) {
    console.error('[academy/pro] pro_subscription checkout missing user_id metadata; session', session.id)
    return
  }

  const subId = (session.subscription as string) ?? null
  const customerId = (session.customer as string) ?? null

  // Pull period bounds from the subscription when available.
  let periodStart: string | null = null
  let periodEnd: string | null = null
  if (subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId)
      periodStart = periodToIso((sub as any).current_period_start)
      periodEnd = periodToIso((sub as any).current_period_end)
    } catch {
      // Non-fatal — customer.subscription.updated will fill the period in.
    }
  }

  const { error } = await service
    .from('pro_subscriptions')
    .upsert(
      {
        user_id: userId,
        status: 'active',
        stripe_subscription_id: subId,
        stripe_customer_id: customerId,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
  if (error) console.error('[academy/pro] pro_subscriptions upsert error:', error)
}

/**
 * customer.subscription.updated / .deleted handler for Pro.
 * Updates status + billing period for the matching pro_subscriptions row.
 */
export async function handleProSubscriptionEvent(
  service: SupabaseClient,
  subscription: Stripe.Subscription,
): Promise<void> {
  const subId = subscription.id
  if (!subId) return

  const status = subscription.status // active | canceled | past_due | trialing | ...
  // pro_subscriptions.status CHECK allows: active | canceled | past_due | trialing.
  const allowed = new Set(['active', 'canceled', 'past_due', 'trialing'])
  const safeStatus = allowed.has(status) ? status : status === 'unpaid' ? 'past_due' : 'canceled'

  const { error } = await service
    .from('pro_subscriptions')
    .update({
      status: safeStatus,
      stripe_customer_id: (subscription.customer as string) ?? null,
      current_period_start: periodToIso((subscription as any).current_period_start),
      current_period_end: periodToIso((subscription as any).current_period_end),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subId)
  if (error) console.error('[academy/pro] pro_subscriptions update error:', error)
}
