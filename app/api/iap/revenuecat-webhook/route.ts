import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const LEASE_SECONDS = 120
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Constant-time string compare: hash both sides so the length cannot leak either. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/** Postgres foreign_key_violation: the user id is a valid uuid but has no profile / wallet. */
const isMissingUser = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === '23503' || /foreign key/i.test(e.message ?? ''))

/**
 * A purchase for a user that does not exist can never be credited, and retrying cannot change that
 * (RevenueCat would retry for days). Record it for a person and acknowledge the event.
 */
async function recordUnknownUser(
  service: ReturnType<typeof createServiceClient>,
  { eventId, type, appUserId, productId }: { eventId: string; type: string; appUserId: string; productId: string },
) {
  const { error } = await service.from('money_exceptions').upsert(
    {
      dedupe_key: `iap-unknown-user:${eventId}`,
      kind: 'iap_unknown_user',
      user_id: null, // the id has no profile, so it cannot be stored as a user reference
      ref: eventId,
      detail: { app_user_id: appUserId, type, product_id: productId },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'dedupe_key' },
  )
  if (error) throw new Error(`could not record the unknown-user purchase: ${error.message}`)
  console.error(`[iap] ${type} ${eventId}: app_user_id ${appUserId} has no profile - recorded in money_exceptions, not retrying`)
}

/**
 * POST /api/iap/revenuecat-webhook
 *
 * RevenueCat server-to-server webhook — credits Hapi Tokens and activates
 * Creator Pro for purchases made through Apple / Google in the mobile app.
 *
 * Setup (RevenueCat dashboard → Integrations → Webhooks):
 *   URL:    https://hapieatstv.com/api/iap/revenuecat-webhook
 *   Header: Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
 *
 * Product conventions:
 *   - Token packs:  product id  hapi_tokens_<amount>   (e.g. hapi_tokens_500)
 *   - Creator Pro:  product id starts with  creator_pro
 *
 * app_user_id is the Supabase user id (the app calls Purchases.configure
 * with appUserID = session.user.id).
 *
 * Idempotent: a two-phase record in iap_events (claim → credit once per RevenueCat
 * event id → complete). See 20260712_mobile_push_tokens.sql (table) and
 * 20261107_money_fixes_833.sql (status/lease columns + claim_iap_event).
 */
export async function POST(req: NextRequest) {
  // ── Auth: shared secret header ──────────────────────────────────────────
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }
  const auth = req.headers.get('authorization') ?? ''
  if (!safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: { event?: Record<string, unknown> }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = payload.event
  if (!event) return NextResponse.json({ ok: true, skipped: 'no event' })

  const eventId = String(event.id ?? '')
  const type = String(event.type ?? '')
  const appUserId = String(event.app_user_id ?? '')
  const productId = String(event.product_id ?? '')

  // Sandbox / TestFlight purchases are free for the tester, so they must never credit real tokens or
  // activate real Creator Pro on a production deployment (a tester could otherwise mint tokens, gift
  // them to a creator and cash out). RevenueCat sends environment SANDBOX | PRODUCTION on every event;
  // anything present that is not PRODUCTION is skipped. Acknowledged with 200 so RevenueCat does not
  // retry, and skipped BEFORE the claim so no iap_events row is written. Outside production builds
  // (dev / preview tests) sandbox events still go through so the purchase flow can be exercised.
  const environment = event.environment == null ? null : String(event.environment).toUpperCase()
  if (environment !== null && environment !== 'PRODUCTION' && process.env.NODE_ENV === 'production') {
    console.log(`[iap] ${String(event.type ?? '')} ${String(event.id ?? '')}: environment ${environment} on a production deployment - ignored`)
    return NextResponse.json({ ok: true, skipped: 'sandbox' })
  }

  // Anonymous RevenueCat ids (never signed in) can't be credited
  if (!appUserId || appUserId.startsWith('$RCAnonymousID')) {
    return NextResponse.json({ ok: true, skipped: 'anonymous user' })
  }
  // iap_events.user_id is a uuid; anything else can never be credited, so retrying is pointless.
  if (!UUID_RE.test(appUserId)) {
    return NextResponse.json({ ok: true, skipped: 'app_user_id is not a user id' })
  }
  // The event id is the idempotency key. Without it we could neither dedupe nor
  // safely credit, so ask RevenueCat to resend (400 is retried by RevenueCat).
  if (!eventId) {
    return NextResponse.json({ error: 'event.id required' }, { status: 400 })
  }

  const service = createServiceClient()

  // ── Two-phase event record (same pattern as the Stripe webhook) ──────────
  // 'claimed' → we fulfil; 'duplicate' → already completed; 'busy' → another
  // delivery is mid-flight (409, RevenueCat retries). A DB error is a 500, never
  // "continue anyway". The credit itself is keyed by the event id, so a retry
  // after a crash or a lost response cannot credit twice or lose the credit.
  const { data: claim, error: claimErr } = await service.rpc('claim_iap_event', {
    p_event_id: eventId,
    p_user_id: appUserId,
    p_type: type,
    p_product_id: productId,
    p_lease_seconds: LEASE_SECONDS,
  })
  if (claimErr) {
    if (isMissingUser(claimErr)) {
      try {
        await recordUnknownUser(service, { eventId, type, appUserId, productId })
      } catch (err) {
        console.error('[iap] unknown user and the exception row failed too:', err)
        return NextResponse.json({ error: 'Could not record event' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, skipped: 'unknown user' })
    }
    console.error('[iap] claim_iap_event failed:', claimErr)
    return NextResponse.json({ error: 'Could not record event' }, { status: 500 })
  }
  if (claim === 'duplicate') return NextResponse.json({ ok: true, skipped: 'duplicate' })
  if (claim === 'busy') return NextResponse.json({ error: 'Event in progress' }, { status: 409 })
  if (claim !== 'claimed') {
    console.error('[iap] unexpected claim result:', claim)
    return NextResponse.json({ error: 'Could not record event' }, { status: 500 })
  }

  try {
    let result
    try {
      result = await fulfil(service, { event, eventId, type, appUserId, productId })
    } catch (err) {
      if (!(err instanceof MissingUserError)) throw err
      await recordUnknownUser(service, { eventId, type, appUserId, productId })
      result = { ok: true, skipped: 'unknown user' }
    }
    const { error: doneErr } = await service.rpc('complete_iap_event', { p_event_id: eventId })
    if (doneErr) throw new Error(`complete_iap_event: ${doneErr.message}`)
    return NextResponse.json(result)
  } catch (err) {
    console.error(`[iap] ${type} ${eventId} failed, releasing lease for retry:`, err)
    const { error: releaseErr } = await service.rpc('release_iap_event', { p_event_id: eventId })
    if (releaseErr) console.error('[iap] could not release lease (will expire):', releaseErr)
    // 500 → RevenueCat retries the webhook
    return NextResponse.json({ error: 'Fulfilment failed' }, { status: 500 })
  }
}

class MissingUserError extends Error {}

async function fulfil(
  service: ReturnType<typeof createServiceClient>,
  { event, eventId, type, appUserId, productId }: {
    event: Record<string, unknown>
    eventId: string
    type: string
    appUserId: string
    productId: string
  },
) {
  // ── Token packs ─────────────────────────────────────────────────────────
  const tokenMatch = productId.match(/hapi_tokens_(\d+)/)
  const isTokenPurchase =
    tokenMatch && ['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL'].includes(type)

  if (isTokenPurchase) {
    const tokens = parseInt(tokenMatch![1], 10)
    if (tokens > 0 && tokens <= 1_000_000) {
      const { error } = await service.rpc('credit_tokens_once', {
        p_key: `revenuecat:event:${eventId}:tokens`,
        p_user_id: appUserId,
        p_type: 'iap_purchase',
        p_amount: tokens,
        p_description: `Purchased ${tokens} tokens (${event.store ?? 'app store'})`,
        p_metadata: { product_id: productId, rc_event_id: eventId, store: event.store ?? null },
      })
      if (isMissingUser(error)) throw new MissingUserError(error!.message)
      if (error) throw new Error(`token credit: ${error.message}`)
    }
    return { ok: true, credited: tokenMatch![1] }
  }

  // ── Token pack refunded by the store ─────────────────────────────────────
  // RevenueCat reports an App Store / Play refund as CANCELLATION with cancel_reason
  // CUSTOMER_SUPPORT. Claw the tokens back the same way a Stripe refund does: one row per
  // transaction (reverse_tokens_for_payment), capped at what was bought, partial + a
  // money_exceptions row when the buyer already spent them. Replays change nothing.
  const refundMatch = productId.match(/hapi_tokens_(\d+)/)
  if (refundMatch && type === 'CANCELLATION' && event.cancel_reason === 'CUSTOMER_SUPPORT') {
    const tokens = parseInt(refundMatch[1], 10)
    const txn = String(event.transaction_id ?? event.original_transaction_id ?? '')
    if (!txn) throw new Error('refund event without a transaction id')
    if (tokens > 0 && tokens <= 1_000_000) {
      const { data: rev, error } = await service.rpc('reverse_tokens_for_payment', {
        p_key: `rc:${txn}`,
        p_user_id: appUserId,
        p_purchased: tokens,
        p_source: 'refund',
        p_source_tokens: tokens,
        p_reason: 'iap_refund',
        p_metadata: { rc_event_id: eventId, product_id: productId, store: event.store ?? null },
      })
      if (isMissingUser(error)) throw new MissingUserError(error!.message)
      if (error) throw new Error(`iap refund clawback: ${error.message}`)
      if (rev?.shortfall > 0) {
        console.error(`[iap] refund ${eventId}: ${rev.shortfall} tokens not recoverable from ${appUserId} (already spent) - see money_exceptions`)
      }
    }
    return { ok: true, refunded: refundMatch[1] }
  }

  // ── Creator Pro subscription ────────────────────────────────────────────
  if (productId.startsWith('creator_pro')) {
    if (['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE'].includes(type)) {
      const { error } = await service
        .from('profiles')
        .update({ platform_subscription_status: 'active' })
        .eq('id', appUserId)
      if (error) throw new Error(`creator pro activate: ${error.message}`)
    } else if (type === 'EXPIRATION') {
      // CANCELLATION = auto-renew turned off (still active until period end).
      // Only EXPIRATION actually removes access.
      const { error } = await service
        .from('profiles')
        .update({ platform_subscription_status: 'canceled' })
        .eq('id', appUserId)
      if (error) throw new Error(`creator pro expire: ${error.message}`)
    }
    return { ok: true, subscription: type }
  }

  return { ok: true, skipped: `unhandled product ${productId}` }
}
