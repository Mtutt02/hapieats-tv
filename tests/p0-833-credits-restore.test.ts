import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MoneyDb } from './helpers/fake-money-db'

// #833 fix 3: credits debited before a partial Stripe checkout come back — exactly once —
// when the checkout expires, its async payment fails, or the session can't even be created.

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  sessionsCreate: vi.fn(),
  customersCreate: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createServiceClient: mocks.createServiceClient,
}))
vi.mock('next/headers', () => ({ headers: () => ({ get: () => 'sig_test' }) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => ({ allowed: true }) }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: (body: string) => JSON.parse(body) },
    checkout: { sessions: { create: mocks.sessionsCreate, list: vi.fn(async () => ({ data: [] })) } },
    customers: { create: mocks.customersCreate, retrieve: vi.fn() },
    subscriptions: { retrieve: vi.fn() },
  },
}))

import { POST as stripeWebhook } from '@/app/api/stripe/webhook/route'
import { POST as creditsCheckout } from '@/app/api/credits/checkout/route'

const USER = 'user-1'
let db: MoneyDb

const seed = () => ({
  app_credits: [{ user_id: USER, gift_balance: '4.00', loan_balance: '1.00', loan_repaid: '0' }],
  videos: [{ id: 'vid-1', title: 'Paid class', price: '10.00' }],
  profiles: [{ id: USER, stripe_customer_id: 'cus_1' }],
})
const gift = () => Number(db.rows('app_credits')[0].gift_balance)
const loan = () => Number(db.rows('app_credits')[0].loan_balance)

const webhook = (id: string, type: string, sessionId = 'cs_1') =>
  stripeWebhook(new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: JSON.stringify({
      id, type,
      data: { object: { id: sessionId, metadata: { userId: USER, checkoutMode: 'credit_ppv', videoId: 'vid-1', giftUsed: '4', loanUsed: '1', creditsUsed: '5' } } },
    }),
  }))

const checkout = (body: Record<string, unknown> = { mode: 'ppv', videoId: 'vid-1' }) =>
  creditsCheckout(new NextRequest('http://localhost/api/credits/checkout', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_not_a_real_secret'
  db = new MoneyDb(seed())
  mocks.createServiceClient.mockReturnValue(db)
  mocks.createClient.mockReturnValue({
    auth: { getUser: async () => ({ data: { user: { id: USER, email: 'u@example.com' } } }) },
    from: db.from,
  })
})

describe('credits restore', () => {
  it('(1) an expired partial-credit checkout gives the credits back', async () => {
    db.rows('app_credits')[0].gift_balance = '0.00'
    db.rows('app_credits')[0].loan_balance = '0.00' // already debited at checkout time

    const res = await webhook('evt_exp', 'checkout.session.expired')

    expect(res.status).toBe(200)
    expect(gift()).toBe(4)
    expect(loan()).toBe(1)
    expect(db.rows('credit_ledger')).toHaveLength(1)
  })

  it('(2) restores exactly once across a redelivery, a second event id and async_payment_failed', async () => {
    db.rows('app_credits')[0].gift_balance = '0.00'
    db.rows('app_credits')[0].loan_balance = '0.00'

    await webhook('evt_exp', 'checkout.session.expired')
    await webhook('evt_exp', 'checkout.session.expired') // Stripe redelivery
    await webhook('evt_exp_2', 'checkout.session.expired') // different event, same session
    await webhook('evt_fail', 'checkout.session.async_payment_failed') // same session again

    expect(gift()).toBe(4)
    expect(loan()).toBe(1)
    expect(db.rows('credit_ledger')).toHaveLength(1)
  })

  it('(3) a crash after the restore committed, then retry: still restored once', async () => {
    db.rows('app_credits')[0].gift_balance = '0.00'
    db.rows('app_credits')[0].loan_balance = '0.00'
    db.faultRpc('restore_credits_once', 'after')

    expect((await webhook('evt_exp', 'checkout.session.expired')).status).toBe(500)
    expect((await webhook('evt_exp', 'checkout.session.expired')).status).toBe(200)

    expect(gift()).toBe(4)
    expect(loan()).toBe(1)
  })

  it('(4) a session that completes is not restored (only expired / failed sessions are)', async () => {
    db.rows('app_credits')[0].gift_balance = '0.00'
    db.rows('app_credits')[0].loan_balance = '0.00'

    await webhook('evt_done', 'checkout.session.completed')

    expect(gift()).toBe(0)
    expect(loan()).toBe(0)
  })

  it('(5) the Stripe session is created with a bounded expiry so abandoned checkouts do resolve', async () => {
    mocks.sessionsCreate.mockResolvedValue({ id: 'cs_new', url: 'https://checkout.stripe.test/x' })

    const res = await checkout()

    expect(res!.status).toBe(200)
    const args = mocks.sessionsCreate.mock.calls[0][0]
    const ttl = args.expires_at - Math.floor(Date.now() / 1000)
    expect(ttl).toBeGreaterThanOrEqual(30 * 60) // Stripe's minimum
    expect(ttl).toBeLessThanOrEqual(24 * 3600) // Stripe's maximum
    expect(args.metadata).toMatchObject({ checkoutMode: 'credit_ppv', giftUsed: '4', loanUsed: '1' })
    expect(gift()).toBe(0) // debited up front, restored by the webhook if it expires
  })

  it('(6) if the Stripe session cannot be created, the credits are restored immediately and nothing is lost', async () => {
    mocks.sessionsCreate.mockRejectedValue(new Error('stripe is down'))

    const res = await checkout()

    expect(res!.status).toBe(502)
    expect(await res!.json()).toEqual({ error: expect.stringContaining('credits were returned') })
    expect(gift()).toBe(4)
    expect(loan()).toBe(1)
  })
})
