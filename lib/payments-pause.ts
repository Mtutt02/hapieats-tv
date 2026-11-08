import { NextResponse } from 'next/server'

/**
 * Kennedy's safety pause (decided 2026-11-07). Two server-side env flags:
 *
 *   PAYMENTS_PAUSED=1          no new charge may start: checkout sessions, credit packs,
 *                              PPV, subscriptions, enrollments, gifts, repayments
 *   CREATOR_PAYOUTS_PAUSED=1   no payout run, no creator withdrawal / cashout
 *
 * Unset (or anything else) = normal. Enforced on the SERVER in every route that starts a
 * charge or moves money out, so hiding a button is never the only line of defence.
 * Free viewing is never affected, and webhooks (Stripe / RevenueCat) deliberately do NOT
 * check these flags: payments already in flight must still complete.
 */
export const PAYMENTS_PAUSED_MESSAGE =
  'Purchases are paused for a short maintenance. Free videos still play.'
export const PAYOUTS_PAUSED_MESSAGE =
  'Creator payouts are paused for a short maintenance. Your earnings are safe.'

const on = (v: string | undefined) => v === '1' || v?.toLowerCase() === 'true'

export const paymentsPaused = () => on(process.env.PAYMENTS_PAUSED)
export const payoutsPaused = () => on(process.env.CREATOR_PAYOUTS_PAUSED)

/** Returns a 503 to send back when charges are paused, otherwise null. */
export function paymentsPausedResponse(): NextResponse | null {
  if (!paymentsPaused()) return null
  return NextResponse.json({ error: PAYMENTS_PAUSED_MESSAGE, paused: 'payments' }, { status: 503 })
}

/** Returns a 503 to send back when payouts / withdrawals are paused, otherwise null. */
export function payoutsPausedResponse(): NextResponse | null {
  if (!payoutsPaused()) return null
  return NextResponse.json({ error: PAYOUTS_PAUSED_MESSAGE, paused: 'payouts' }, { status: 503 })
}
