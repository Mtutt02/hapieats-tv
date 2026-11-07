import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MoneyDb } from './helpers/fake-money-db'

// #833 fix 1: Stripe webhook two-phase event record + idempotent fulfilment.
// Supabase is an in-memory fake, Stripe is mocked; nothing here touches a network or a secret.

const mocks = vi.hoisted(() => ({ createServiceClient: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: mocks.createServiceClient,
}))
vi.mock('next/headers', () => ({ headers: () => ({ get: () => 'sig_test' }) }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: (body: string) => JSON.parse(body) },
    checkout: { sessions: { list: vi.fn(async () => ({ data: [] })) } },
    customers: { retrieve: vi.fn() },
    subscriptions: { retrieve: vi.fn() },
  },
}))

import { POST } from '@/app/api/stripe/webhook/route'

const USER = 'user-1'

const sessionEvent = (id: string, metadata: Record<string, string>, sessionId = 'cs_1', type = 'checkout.session.completed') => ({
  id,
  type,
  data: { object: { id: sessionId, metadata, amount_total: 500, payment_intent: 'pi_1', payment_status: 'paid' } },
})
const tokenEvent = (id = 'evt_1', sessionId = 'cs_1') =>
  sessionEvent(id, { userId: USER, checkoutMode: 'token_purchase', tokenAmount: '500' }, sessionId)

const deliver = (event: unknown) =>
  POST(new NextRequest('http://localhost/api/stripe/webhook', { method: 'POST', body: JSON.stringify(event) }))

let db: MoneyDb
const useDb = (seed: Record<string, any[]> = {}) => {
  db = new MoneyDb(seed)
  mocks.createServiceClient.mockReturnValue(db)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_not_a_real_secret'
  useDb()
})

describe('stripe webhook — two-phase event record', () => {
  it('(1a) crash after claim: a stale processing lease is taken over and fulfils exactly once', async () => {
    // A previous delivery claimed evt_1, then the function died: row is "processing", lease expired.
    useDb({ stripe_events: [{ id: 'evt_1', type: 'checkout.session.completed', status: 'processing', lease_until: Date.parse('2026-11-07T11:00:00Z'), attempts: 1 }] })

    const res = await deliver(tokenEvent())

    expect(res.status).toBe(200)
    expect(db.tokens(USER)).toBe(500)
    expect(db.rows('stripe_events')[0]).toMatchObject({ status: 'completed', attempts: 2 })

    // Stripe redelivers the same event: now a duplicate, no second credit.
    const again = await deliver(tokenEvent())
    expect(again.status).toBe(200)
    expect(await again.json()).toMatchObject({ duplicate: true })
    expect(db.tokens(USER)).toBe(500)
  })

  it('(1b) a processing row whose lease is still live is not stolen: 409 so Stripe retries later', async () => {
    useDb({ stripe_events: [{ id: 'evt_1', type: 'checkout.session.completed', status: 'processing', lease_until: db.now + 60_000, attempts: 1 }] })

    const res = await deliver(tokenEvent())

    expect(res.status).toBe(409)
    expect(db.tokens(USER)).toBe(0)
  })

  it('(2) error after the wallet credit committed, then retry: credited once, not twice', async () => {
    // Model: the credit commits but the response is lost / the handler throws afterwards.
    // (record_token_movement is the call the OLD code credited through; credit_tokens_once the new one.)
    db.faultRpc('record_token_movement', 'after')
    db.faultRpc('credit_tokens_once', 'after')

    const first = await deliver(tokenEvent())
    expect(first.status).toBe(500)

    const retry = await deliver(tokenEvent())
    expect(retry.status).toBe(200)
    expect(db.tokens(USER)).toBe(500)
  })

  it('(3) two concurrent deliveries of one event: one fulfils, the other is told to retry', async () => {
    const [a, b] = await Promise.all([deliver(tokenEvent()), deliver(tokenEvent())])

    expect([a.status, b.status].sort()).toEqual([200, 409])
    expect(db.tokens(USER)).toBe(500)
    expect(db.rows('stripe_events')).toHaveLength(1)
  })

  it('(4) a non-unique-violation error on the stripe_events insert returns 500 and fulfils nothing', async () => {
    db.failTable('stripe_events', 'insert', { code: '42P01', message: 'relation "stripe_events" does not exist' })

    const res = await deliver(tokenEvent())

    expect(res.status).toBe(500)
    expect(db.tokens(USER)).toBe(0)
  })

  it('(5) a failed DB write fails the event instead of being ignored', async () => {
    db.failTable('class_enrollments', 'upsert', { code: '23503', message: 'fk violation' })

    const res = await deliver(sessionEvent('evt_2', { userId: USER, checkoutMode: 'class_enrollment', classId: 'class-1' }))

    expect(res.status).toBe(500)
    expect(db.rows('stripe_events')[0].status).toBe('processing') // never marked completed
  })

  it('(6) Stripe resending one payment under a new event id does not double-count the course enrollment', async () => {
    useDb({ courses: [{ id: 'course-1', enrollment_count: 0 }] })
    const meta = { userId: USER, checkoutMode: 'course_enrollment', courseId: 'course-1', priceUsd: '20' }

    expect((await deliver(sessionEvent('evt_a', meta, 'cs_course'))).status).toBe(200)
    expect((await deliver(sessionEvent('evt_b', meta, 'cs_course'))).status).toBe(200)

    expect(db.rows('course_enrollments')).toHaveLength(1)
    expect(db.rows('courses')[0].enrollment_count).toBe(1)
  })

  it('(7) the same checkout session under two event ids credits tokens once', async () => {
    await deliver(tokenEvent('evt_a', 'cs_same'))
    await deliver(tokenEvent('evt_b', 'cs_same'))

    expect(db.tokens(USER)).toBe(500)
  })

  it('(8) a pay-per-view replay does not error on the (buyer, video) unique key', async () => {
    const meta = { userId: USER, checkoutMode: 'pay_per_view', videoId: 'vid-1' }

    expect((await deliver(sessionEvent('evt_a', meta, 'cs_ppv'))).status).toBe(200)
    expect((await deliver(sessionEvent('evt_b', meta, 'cs_ppv'))).status).toBe(200)

    expect(db.rows('purchases')).toHaveLength(1)
  })
})
