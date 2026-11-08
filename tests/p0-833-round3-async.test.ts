import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MoneyDb } from './helpers/fake-money-db'

// #833 round 3, finding 3: an async (delayed) payment must not fulfil anything — and must not
// hand back credits as if it had — until the money has actually arrived.

const mocks = vi.hoisted(() => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createServiceClient: mocks.createServiceClient }))
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
let db: MoneyDb

const deliver = (id: string, type: string, session: Record<string, unknown>) =>
  POST(new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: JSON.stringify({ id, type, data: { object: { id: 'cs_async', amount_total: 500, payment_intent: 'pi_async', ...session } } }),
  }))

const creditPpv = (payment_status: string) => ({
  payment_status,
  metadata: { userId: USER, checkoutMode: 'credit_ppv', videoId: 'vid-1', giftUsed: '4', loanUsed: '1', creditsUsed: '5' },
})
const tokens = (payment_status: string) => ({
  payment_status,
  metadata: { userId: USER, checkoutMode: 'token_purchase', tokenAmount: '500' },
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_not_a_real_secret'
  // credits were debited at checkout time: 4 gift + 1 loan are "out"
  db = new MoneyDb({ app_credits: [{ user_id: USER, gift_balance: '0.00', loan_balance: '0.00', loan_repaid: '0' }] })
  mocks.createServiceClient.mockReturnValue(db)
})

describe('async payments (finding 3)', () => {
  it('completed(unpaid) -> async_payment_failed: no unlock, credits restored exactly once', async () => {
    expect((await deliver('evt_1', 'checkout.session.completed', creditPpv('unpaid'))).status).toBe(200)
    expect(db.rows('purchases')).toHaveLength(0) // not unlocked on an unpaid session

    expect((await deliver('evt_2', 'checkout.session.async_payment_failed', creditPpv('unpaid'))).status).toBe(200)
    expect((await deliver('evt_3', 'checkout.session.async_payment_failed', creditPpv('unpaid'))).status).toBe(200) // Stripe resend, new id
    expect((await deliver('evt_2', 'checkout.session.async_payment_failed', creditPpv('unpaid'))).status).toBe(200) // redelivery

    expect(db.rows('purchases')).toHaveLength(0)
    expect(Number(db.rows('app_credits')[0].gift_balance)).toBe(4)
    expect(Number(db.rows('app_credits')[0].loan_balance)).toBe(1)
    expect(db.rows('credit_ledger')).toHaveLength(1)
  })

  it('completed(unpaid) -> async_payment_succeeded: fulfilled exactly once, credits are NOT restored', async () => {
    await deliver('evt_1', 'checkout.session.completed', creditPpv('unpaid'))
    expect(db.rows('purchases')).toHaveLength(0)

    await deliver('evt_2', 'checkout.session.async_payment_succeeded', creditPpv('paid'))
    await deliver('evt_3', 'checkout.session.async_payment_succeeded', creditPpv('paid')) // second event id
    await deliver('evt_2', 'checkout.session.async_payment_succeeded', creditPpv('paid')) // redelivery

    expect(db.rows('purchases')).toHaveLength(1)
    expect(db.rows('purchases')[0]).toMatchObject({ buyer_id: USER, video_id: 'vid-1', credit_funded: true })
    expect(Number(db.rows('app_credits')[0].gift_balance)).toBe(0)
    expect(db.rows('credit_ledger')).toHaveLength(0)
  })

  it('a token pack on an unpaid session credits nothing until async_payment_succeeded, then once', async () => {
    await deliver('evt_1', 'checkout.session.completed', tokens('unpaid'))
    expect(db.tokens(USER)).toBe(0)

    await deliver('evt_2', 'checkout.session.async_payment_succeeded', tokens('paid'))
    await deliver('evt_3', 'checkout.session.completed', tokens('paid')) // a (late) paid completed for the same session
    expect(db.tokens(USER)).toBe(500)
    expect(db.rows('token_ledger')).toHaveLength(1)
  })

  it('a normal card payment (completed, paid) still fulfils immediately', async () => {
    expect((await deliver('evt_1', 'checkout.session.completed', tokens('paid'))).status).toBe(200)
    expect(db.tokens(USER)).toBe(500)
  })

  it('a zero-amount session (no_payment_required) fulfils: there is nothing to collect', async () => {
    await deliver('evt_1', 'checkout.session.completed', tokens('no_payment_required'))
    expect(db.tokens(USER)).toBe(500)
  })
})
