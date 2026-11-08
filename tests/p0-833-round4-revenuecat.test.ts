import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MoneyDb } from './helpers/fake-money-db'

// #833 round 4, F18: RevenueCat refund clawback, constant-time auth, an unknown user is recorded
// for review instead of being retried forever. (Payload fields follow RevenueCat's documented
// webhook format; NOT verified against a live RevenueCat event.)

const mocks = vi.hoisted(() => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createServiceClient: mocks.createServiceClient }))

import { POST } from '@/app/api/iap/revenuecat-webhook/route'

const USER = '11111111-1111-4111-8111-111111111111'
const SECRET = 'rc_test_secret_value'

const purchase = (over: Record<string, unknown> = {}) => ({
  event: { id: 'rc_buy_1', type: 'NON_RENEWING_PURCHASE', app_user_id: USER, product_id: 'hapi_tokens_500', store: 'APP_STORE', transaction_id: 'txn_1', ...over },
})
const refund = (over: Record<string, unknown> = {}) => ({
  event: { id: 'rc_ref_1', type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT', app_user_id: USER, product_id: 'hapi_tokens_500', store: 'APP_STORE', transaction_id: 'txn_1', ...over },
})
const deliver = (payload: unknown, auth = `Bearer ${SECRET}`) =>
  POST(new NextRequest('http://localhost/api/iap/revenuecat-webhook', {
    method: 'POST',
    headers: { authorization: auth },
    body: JSON.stringify(payload),
  }))

let db: MoneyDb
beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  process.env.REVENUECAT_WEBHOOK_SECRET = SECRET
  db = new MoneyDb()
  mocks.createServiceClient.mockReturnValue(db)
})

describe('store refund claws the tokens back (F18)', () => {
  it('buy 500, refund: balance back to 0, keyed rc:<transaction>', async () => {
    await deliver(purchase())
    expect(db.tokens(USER)).toBe(500)

    const res = await deliver(refund())

    expect(res.status).toBe(200)
    expect(db.tokens(USER)).toBe(0)
    expect(db.rows('token_reversals')[0]).toMatchObject({ effect_key: 'rc:txn_1', purchased: 500, refund_tokens: 500, reversed: 500 })
  })

  it('a replayed refund event and a second refund event for the same transaction reverse once', async () => {
    await deliver(purchase())
    await deliver(refund())
    db.rows('hapi_tokens')[0].balance = 500 // tokens earned elsewhere afterwards
    await deliver(refund()) // same event id: duplicate
    await deliver(refund({ id: 'rc_ref_2' })) // new event id, same transaction
    expect(db.tokens(USER)).toBe(500)
    expect(db.rows('token_ledger').filter(l => l.type === 'refund')).toHaveLength(1)
  })

  it('the buyer already spent some: available tokens are clawed back, the shortfall goes to money_exceptions, event completes', async () => {
    await deliver(purchase())
    db.rows('hapi_tokens')[0].balance = 120
    const res = await deliver(refund())
    expect(res.status).toBe(200)
    expect(db.tokens(USER)).toBe(0)
    expect(db.rows('money_exceptions')).toHaveLength(1)
    expect(db.rows('money_exceptions')[0]).toMatchObject({ kind: 'token_clawback_shortfall', amount: 380 })
    expect(db.rows('iap_events')[0].status).toBe('completed')
  })

  it('a CANCELLATION that is NOT a refund (auto-renew turned off) claws back nothing', async () => {
    await deliver(purchase())
    const res = await deliver(refund({ cancel_reason: 'UNSUBSCRIBE' }))
    expect(res.status).toBe(200)
    expect(db.tokens(USER)).toBe(500)
    expect(db.rows('token_reversals')).toHaveLength(0)
  })

  it('a refund event without a transaction id fails (RevenueCat retries) instead of guessing a key', async () => {
    await deliver(purchase())
    const res = await deliver(refund({ transaction_id: undefined, original_transaction_id: undefined }))
    expect(res.status).toBe(500)
    expect(db.tokens(USER)).toBe(500)
  })
})

describe('auth compare (F18)', () => {
  it('wrong, empty, near-miss and longer secrets are rejected; the right one is accepted', async () => {
    for (const bad of ['', 'Bearer wrong', `Bearer ${SECRET}x`, `Bearer ${SECRET.slice(0, -1)}`, SECRET]) {
      expect((await deliver(purchase(), bad)).status).toBe(401)
    }
    expect((await deliver(purchase())).status).toBe(200)
  })
})

describe('unknown user (F18)', () => {
  it('a valid uuid with no profile is recorded in money_exceptions and acknowledged (no retry loop)', async () => {
    db.faultRpc('credit_tokens_once', 'before', { code: '23503', message: 'insert or update on table "hapi_tokens" violates foreign key constraint' })

    const res = await deliver(purchase())

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ skipped: 'unknown user' })
    expect(db.rows('money_exceptions')).toHaveLength(1)
    expect(db.rows('money_exceptions')[0]).toMatchObject({ dedupe_key: 'iap-unknown-user:rc_buy_1', kind: 'iap_unknown_user', ref: 'rc_buy_1' })
    expect(db.rows('iap_events')[0].status).toBe('completed')
  })

  it('any OTHER database error is still a 500 so RevenueCat retries', async () => {
    db.faultRpc('credit_tokens_once', 'before', { code: 'XX000', message: 'boom' })
    expect((await deliver(purchase())).status).toBe(500)
    expect(db.rows('money_exceptions')).toHaveLength(0)
  })
})
