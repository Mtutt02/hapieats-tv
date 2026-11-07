import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MoneyDb } from './helpers/fake-money-db'

// #833 fix 2: RevenueCat webhook — idempotent per event id, no lost or doubled credits.

const mocks = vi.hoisted(() => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: mocks.createServiceClient,
}))

import { POST } from '@/app/api/iap/revenuecat-webhook/route'

const USER = '11111111-1111-4111-8111-111111111111'
const SECRET = 'rc_test_secret_value'

const rcEvent = (over: Record<string, unknown> = {}) => ({
  event: { id: 'rc_evt_1', type: 'NON_RENEWING_PURCHASE', app_user_id: USER, product_id: 'hapi_tokens_500', store: 'APP_STORE', ...over },
})
const deliver = (payload: unknown) =>
  POST(new NextRequest('http://localhost/api/iap/revenuecat-webhook', {
    method: 'POST',
    headers: { authorization: `Bearer ${SECRET}` },
    body: JSON.stringify(payload),
  }))

let db: MoneyDb
const useDb = (seed: Record<string, any[]> = {}) => {
  db = new MoneyDb(seed)
  mocks.createServiceClient.mockReturnValue(db)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  process.env.REVENUECAT_WEBHOOK_SECRET = SECRET
  useDb()
})

describe('revenuecat webhook', () => {
  it('(1) a duplicate RevenueCat event credits once', async () => {
    expect((await deliver(rcEvent())).status).toBe(200)
    const dup = await deliver(rcEvent())

    expect(dup.status).toBe(200)
    expect(await dup.json()).toMatchObject({ skipped: 'duplicate' })
    expect(db.tokens(USER)).toBe(500)
  })

  it('(2) crash after the event was logged but before crediting: the retry still credits (nothing lost)', async () => {
    // The old code logged the event first and then credited; a crash between the two
    // left a log row, so every retry was skipped as a duplicate and the buyer got nothing.
    useDb({ iap_events: [{ event_id: 'rc_evt_1', user_id: USER, status: 'processing', lease_until: Date.parse('2026-11-07T11:00:00Z'), attempts: 1 }] })
    // an old-scheme row (no status) would mean "done"; the new scheme only trusts status='completed'

    const res = await deliver(rcEvent())

    expect(res.status).toBe(200)
    expect(db.tokens(USER)).toBe(500)
    expect(db.rows('iap_events')[0].status).toBe('completed')
  })

  it('(3) credit committed but the response was lost: the retry does not credit again', async () => {
    db.faultRpc('record_token_movement', 'after') // old code path
    db.faultRpc('credit_tokens_once', 'after') // new code path

    const first = await deliver(rcEvent())
    expect(first.status).toBe(500)
    const retry = await deliver(rcEvent())

    expect(retry.status).toBe(200)
    expect(db.tokens(USER)).toBe(500)
  })

  it('(4) an event-log insert failure is a 500 and credits nothing (old code credited anyway)', async () => {
    db.failTable('iap_events', 'insert', { code: '42P01', message: 'relation does not exist' })

    const res = await deliver(rcEvent())

    expect(res.status).toBe(500)
    expect(db.tokens(USER)).toBe(0)
  })

  it('(5) two concurrent deliveries of one event: one credit, the other told to retry', async () => {
    const [a, b] = await Promise.all([deliver(rcEvent()), deliver(rcEvent())])

    expect([a.status, b.status].sort()).toEqual([200, 409])
    expect(db.tokens(USER)).toBe(500)
  })

  it('(6) a failed Creator Pro profile update fails the event so RevenueCat retries', async () => {
    db.failTable('profiles', 'update', { code: 'XX000', message: 'boom' })

    const res = await deliver(rcEvent({ product_id: 'creator_pro_monthly', type: 'INITIAL_PURCHASE' }))

    expect(res.status).toBe(500)
    expect(db.rows('iap_events')[0].status).toBe('processing')
  })
})
