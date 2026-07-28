import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
 * Idempotent: RevenueCat event ids are recorded in iap_events (see
 * supabase/migrations/20260712_mobile_push_tokens.sql) and duplicates are ignored.
 */
export async function POST(req: NextRequest) {
  // ── Auth: shared secret header ──────────────────────────────────────────
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${secret}`) {
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

  // Anonymous RevenueCat ids (never signed in) can't be credited
  if (!appUserId || appUserId.startsWith('$RCAnonymousID')) {
    return NextResponse.json({ ok: true, skipped: 'anonymous user' })
  }

  const service = createServiceClient()

  // ── Idempotency ─────────────────────────────────────────────────────────
  if (eventId) {
    const { error: dupErr } = await service
      .from('iap_events')
      .insert({ event_id: eventId, user_id: appUserId, type, product_id: productId })
    if (dupErr) {
      // 23505 = unique_violation → already processed
      if (dupErr.code === '23505') return NextResponse.json({ ok: true, skipped: 'duplicate' })
      console.error('[iap] event log insert failed:', dupErr)
      // continue anyway — crediting is more important than logging
    }
  }

  // ── Token packs ─────────────────────────────────────────────────────────
  const tokenMatch = productId.match(/hapi_tokens_(\d+)/)
  const isTokenPurchase =
    tokenMatch && ['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL'].includes(type)

  if (isTokenPurchase) {
    const tokens = parseInt(tokenMatch![1], 10)
    if (tokens > 0 && tokens <= 1_000_000) {
      const { error } = await service.rpc('record_token_movement', {
        p_user_id: appUserId,
        p_type: 'iap_purchase',
        p_amount: tokens,
        p_related_user: null,
        p_description: `Purchased ${tokens} tokens (${event.store ?? 'app store'})`,
        p_metadata: { product_id: productId, rc_event_id: eventId, store: event.store ?? null },
      })
      if (error) {
        console.error('[iap] token credit failed:', error)
        // 500 → RevenueCat retries the webhook
        return NextResponse.json({ error: 'Credit failed' }, { status: 500 })
      }
    }
    return NextResponse.json({ ok: true, credited: tokenMatch![1] })
  }

  // ── Creator Pro subscription ────────────────────────────────────────────
  if (productId.startsWith('creator_pro')) {
    if (['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE'].includes(type)) {
      await service
        .from('profiles')
        .update({ platform_subscription_status: 'active' })
        .eq('id', appUserId)
    } else if (['EXPIRATION', 'CANCELLATION'].includes(type)) {
      // CANCELLATION = auto-renew turned off (still active until period end).
      // Only EXPIRATION actually removes access.
      if (type === 'EXPIRATION') {
        await service
          .from('profiles')
          .update({ platform_subscription_status: 'canceled' })
          .eq('id', appUserId)
      }
    }
    return NextResponse.json({ ok: true, subscription: type })
  }

  return NextResponse.json({ ok: true, skipped: `unhandled product ${productId}` })
}
