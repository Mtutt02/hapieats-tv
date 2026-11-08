import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MoneyDb } from './helpers/fake-money-db'

// #833 round 3, findings 2 and 10: token clawback is keyed per PAYMENT, proportional to what was
// refunded, capped at what was bought; a clawback the buyer can't cover is partial + recorded for
// review; disputes shrink the Pro revenue ledger.

const mocks = vi.hoisted(() => ({ createServiceClient: vi.fn(), sessionsList: vi.fn(), chargesRetrieve: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createServiceClient: mocks.createServiceClient }))
vi.mock('next/headers', () => ({ headers: () => ({ get: () => 'sig_test' }) }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: (body: string) => JSON.parse(body) },
    checkout: { sessions: { list: mocks.sessionsList } },
    charges: { retrieve: mocks.chargesRetrieve },
    customers: { retrieve: vi.fn() },
    subscriptions: { retrieve: vi.fn() },
  },
}))

import { POST } from '@/app/api/stripe/webhook/route'

const USER = 'user-1'
const PI = 'pi_tok'
let db: MoneyDb
let seq = 0

const deliver = (type: string, object: Record<string, unknown>) =>
  POST(new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: JSON.stringify({ id: `evt_${++seq}`, type, data: { object } }),
  }))

// $10.00 pack = 1000 cents = 1000 tokens
const refund = (amount_refunded: number, extra: Record<string, unknown> = {}) =>
  deliver('charge.refunded', { id: 'ch_1', amount: 1000, amount_refunded, refunded: amount_refunded >= 1000, payment_intent: PI, ...extra })
const dispute = (amount: number) =>
  deliver('charge.dispute.created', { id: 'dp_1', amount, payment_intent: PI, charge: 'ch_1' })

beforeEach(() => {
  vi.clearAllMocks()
  seq = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_not_a_real_secret'
  db = new MoneyDb({ hapi_tokens: [{ user_id: USER, balance: 1000 }] }) // the buyer holds the 1000 they bought
  mocks.createServiceClient.mockReturnValue(db)
  mocks.sessionsList.mockResolvedValue({
    data: [{ id: 'cs_tok', amount_total: 1000, metadata: { userId: USER, checkoutMode: 'token_purchase', tokenAmount: '1000' } }],
  })
  mocks.chargesRetrieve.mockResolvedValue({ id: 'ch_1', invoice: null })
})

describe('token clawback keyed per payment (finding 2)', () => {
  it('a full refund and then a dispute on the same charge reverse the purchase once, never twice', async () => {
    expect((await refund(1000)).status).toBe(200)
    expect(db.tokens(USER)).toBe(0)

    // the buyer re-earns 1000 other tokens; a second event for the SAME charge must not touch them
    db.rows('hapi_tokens')[0].balance = 1000
    expect((await dispute(1000)).status).toBe(200)

    expect(db.tokens(USER)).toBe(1000)
    expect(db.rows('token_reversals')).toHaveLength(1)
    expect(db.rows('token_reversals')[0]).toMatchObject({ effect_key: `stripe:pi:${PI}:token-reversal`, reversed: 1000 })
    expect(db.rows('token_ledger').filter(l => l.type === 'refund')).toHaveLength(1)
  })

  it('the dispute first, then the refund: same result', async () => {
    await dispute(1000)
    db.rows('hapi_tokens')[0].balance = 1000
    await refund(1000)
    expect(db.tokens(USER)).toBe(1000)
    expect(db.rows('token_reversals')[0].reversed).toBe(1000)
  })

  it('two partial refunds reverse in proportion to the cumulative amount refunded (30%, then 60%)', async () => {
    await refund(300)
    expect(db.tokens(USER)).toBe(700)

    await refund(600) // Stripe reports the CUMULATIVE refunded amount
    expect(db.tokens(USER)).toBe(400)

    // a late redelivery of the first partial refund (new event id) changes nothing
    await refund(300)
    expect(db.tokens(USER)).toBe(400)
    expect(db.rows('token_reversals')[0].reversed).toBe(600)
  })

  it('a partial refund then the rest never reverses more than was bought', async () => {
    await refund(600)
    await refund(1000)
    await dispute(1000)
    expect(db.tokens(USER)).toBe(0)
    expect(db.rows('token_reversals')[0].reversed).toBe(1000)
    expect(db.rows('token_ledger').filter(l => l.type === 'refund').reduce((s, l) => s + Math.abs(l.amount), 0)).toBe(1000)
  })

  it('the same event redelivered is a no-op', async () => {
    const body = JSON.stringify({ id: 'evt_same', type: 'charge.refunded', data: { object: { id: 'ch_1', amount: 1000, amount_refunded: 400, payment_intent: PI } } })
    const send = () => POST(new NextRequest('http://localhost/api/stripe/webhook', { method: 'POST', body }))
    await send()
    await send()
    expect(db.tokens(USER)).toBe(600)
  })
})

describe('a clawback the buyer cannot cover (finding 10)', () => {
  it('claws back what is left, records the shortfall for review, and completes the event', async () => {
    db.rows('hapi_tokens')[0].balance = 200 // they spent 800 of the 1000

    const res = await refund(1000)

    expect(res.status).toBe(200)
    expect(db.tokens(USER)).toBe(0)
    expect(db.rows('token_reversals')[0].reversed).toBe(200)
    expect(db.rows('money_exceptions')).toHaveLength(1)
    expect(db.rows('money_exceptions')[0]).toMatchObject({ kind: 'token_clawback_shortfall', user_id: USER, amount: 800, resolved_at: null })
    expect(db.rows('stripe_events')[0].status).toBe('completed')
  })

  it('a redelivery does not duplicate the exception row; when tokens reappear a later event recovers more', async () => {
    db.rows('hapi_tokens')[0].balance = 200
    await refund(1000)
    await refund(1000)
    expect(db.rows('money_exceptions')).toHaveLength(1)

    db.rows('hapi_tokens')[0].balance = 500
    await dispute(1000)
    expect(db.tokens(USER)).toBe(0)
    expect(db.rows('token_reversals')[0].reversed).toBe(700)
    expect(db.rows('money_exceptions')[0].amount).toBe(300)
  })
})

describe('disputes shrink the Pro revenue ledger (finding 10)', () => {
  it('a dispute on a Pro invoice charge records disputed_cents and the payout gross nets it out', async () => {
    db = new MoneyDb({
      pro_revenue_ledger: [{ stripe_invoice_id: 'in_pro', amount_cents: 1299, refunded_cents: 0, disputed_cents: 0, month: '2026-10' }],
    })
    mocks.createServiceClient.mockReturnValue(db)
    mocks.chargesRetrieve.mockResolvedValue({ id: 'ch_1', invoice: 'in_pro' })
    mocks.sessionsList.mockResolvedValue({ data: [] })

    expect((await dispute(1299)).status).toBe(200)

    expect(db.rows('pro_revenue_ledger')[0].disputed_cents).toBe(1299)
    expect(mocks.chargesRetrieve).toHaveBeenCalledWith('ch_1')
    // run_pro_payout's gross for the month is now 0 (1299 - 0 - 1299)
    const { data } = await db.rpc('run_pro_payout', { p_month: '2026-10', p_expected_gross: 0, p_pool_cents: 0, p_total_credits: 0, p_earnings: [] })
    expect(data).toMatchObject({ status: 'distributed', gross_cents: 0 })
  })
})
