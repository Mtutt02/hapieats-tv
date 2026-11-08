import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MoneyDb } from './helpers/fake-money-db'

// #833 round 4: N2 (basil moved current_period_end), N1/F9 (basil charges no longer name their invoice:
// match the Pro ledger by payment intent), S3 (charge.dispute.closed, merchant won).

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  sessionsList: vi.fn(),
  chargesRetrieve: vi.fn(),
  invoicePaymentsList: vi.fn(),
  customersRetrieve: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createServiceClient: mocks.createServiceClient }))
vi.mock('next/headers', () => ({ headers: () => ({ get: () => 'sig_test' }) }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: (body: string) => JSON.parse(body) },
    checkout: { sessions: { list: mocks.sessionsList } },
    charges: { retrieve: mocks.chargesRetrieve },
    invoicePayments: { list: mocks.invoicePaymentsList },
    customers: { retrieve: mocks.customersRetrieve },
    subscriptions: { retrieve: mocks.subscriptionsRetrieve },
  },
}))

import { POST } from '@/app/api/stripe/webhook/route'
import { handleProCheckoutCompleted, handleProSubscriptionEvent } from '@/lib/academy/pro'
import { currentPeriodEnd, currentPeriodStart, invoicePaymentIntentId } from '@/lib/stripe-shapes'

let db: MoneyDb
let seq = 0
const deliver = (type: string, object: Record<string, unknown>, id?: string) =>
  POST(new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: JSON.stringify({ id: id ?? `evt_${++seq}`, type, data: { object } }),
  }))

const paidSec = Date.parse('2026-10-15T00:00:00Z') / 1000
const endSec = Date.parse('2026-11-15T00:00:00Z') / 1000
const endIso = new Date(endSec * 1000).toISOString()
const invoiceBase = { id: 'in_1', amount_paid: 1299, currency: 'usd', created: paidSec, status_transitions: { paid_at: paidSec } }
const proMeta = { kind: 'pro_subscription', user_id: 'u1' }
const ledger = () => db.rows('pro_revenue_ledger')

beforeEach(() => {
  vi.clearAllMocks()
  seq = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_not_a_real_secret'
  db = new MoneyDb()
  mocks.createServiceClient.mockReturnValue(db)
  mocks.sessionsList.mockResolvedValue({ data: [] })
  mocks.chargesRetrieve.mockResolvedValue({ id: 'ch_1' })
  mocks.invoicePaymentsList.mockResolvedValue({ data: [] })
})

// ── N2 ───────────────────────────────────────────────────────────────────────
describe('N2: subscription period end in either payload shape', () => {
  it('helpers: top-level (pre-basil), item level (basil), neither -> null', () => {
    expect(currentPeriodEnd({ current_period_end: endSec } as any)).toBe(endSec)
    expect(currentPeriodEnd({ items: { data: [{ current_period_end: endSec }] } } as any)).toBe(endSec)
    expect(currentPeriodEnd({ items: { data: [] } } as any)).toBeNull()
    expect(currentPeriodEnd({} as any)).toBeNull()
    expect(currentPeriodStart({ items: { data: [{ current_period_start: paidSec }] } } as any)).toBe(paidSec)
  })

  const channelSub = (extra: Record<string, unknown>) => ({
    id: 'sub_c', status: 'active', customer: 'cus_1', metadata: { userId: 'u1', channelId: 'ch1' }, ...extra,
  })

  it('basil: current_period_end only on the item -> row written with it, event completes (was a RangeError retried forever)', async () => {
    const res = await deliver('customer.subscription.updated', channelSub({ items: { data: [{ current_period_end: endSec }] } }))
    expect(res.status).toBe(200)
    expect(db.rows('subscriptions')[0]).toMatchObject({ stripe_subscription_id: 'sub_c', status: 'active', current_period_end: endIso })
    expect(db.rows('stripe_events')[0].status).toBe('completed')
  })

  it('pre-basil: top-level current_period_end still works', async () => {
    const res = await deliver('customer.subscription.created', channelSub({ current_period_end: endSec }))
    expect(res.status).toBe(200)
    expect(db.rows('subscriptions')[0].current_period_end).toBe(endIso)
  })

  it('neither shape: no throw, 200, status still written, an existing period is not overwritten with null', async () => {
    db.rows('subscriptions').push({ stripe_subscription_id: 'sub_c', subscriber_id: 'u1', channel_id: 'ch1', status: 'active', current_period_end: endIso })
    const res = await deliver('customer.subscription.updated', channelSub({ status: 'past_due' }))
    expect(res.status).toBe(200)
    expect(db.rows('subscriptions')).toHaveLength(1)
    expect(db.rows('subscriptions')[0]).toMatchObject({ status: 'past_due', current_period_end: endIso })
  })

  it('a brand-new row with no period anywhere is written without one (null), still 200', async () => {
    const res = await deliver('customer.subscription.created', channelSub({}))
    expect(res.status).toBe(200)
    expect(db.rows('subscriptions')[0].current_period_end).toBeUndefined()
  })

  it('Pro handlers (lib/academy/pro.ts): basil subscription fills the period, neither shape does not throw or wipe it', async () => {
    const pro = new MoneyDb({ pro_subscriptions: [{ user_id: 'u1', stripe_subscription_id: 'sub_p', status: 'active', current_period_end: 'old' }] })
    await handleProSubscriptionEvent(pro as any, { id: 'sub_p', status: 'active', customer: 'cus_1', items: { data: [{ current_period_start: paidSec, current_period_end: endSec }] } } as any)
    expect(pro.rows('pro_subscriptions')[0]).toMatchObject({ current_period_end: endIso, current_period_start: new Date(paidSec * 1000).toISOString() })

    await handleProSubscriptionEvent(pro as any, { id: 'sub_p', status: 'canceled', customer: 'cus_1' } as any)
    expect(pro.rows('pro_subscriptions')[0]).toMatchObject({ status: 'canceled', current_period_end: endIso })

    // checkout.session.completed path retrieves the subscription (basil shape)
    mocks.subscriptionsRetrieve.mockResolvedValue({ id: 'sub_n', items: { data: [{ current_period_start: paidSec, current_period_end: endSec }] } })
    const fresh = new MoneyDb()
    await handleProCheckoutCompleted(fresh as any, { id: 'cs_1', subscription: 'sub_n', customer: 'cus_9', metadata: proMeta } as any)
    expect(fresh.rows('pro_subscriptions')[0]).toMatchObject({ user_id: 'u1', current_period_end: endIso })
  })
})

// ── N1 / F9: invoice.paid stamps the payment intent ──────────────────────────
describe('N1: invoice.paid records the payment intent on the ledger row', () => {
  it('pre-basil: invoice.payment_intent', async () => {
    await deliver('invoice.paid', { ...invoiceBase, subscription: 'sub_1', tax: 99, payment_intent: 'pi_old', subscription_details: { metadata: proMeta } })
    expect(ledger()).toHaveLength(1)
    expect(ledger()[0]).toMatchObject({ stripe_invoice_id: 'in_1', stripe_payment_intent_id: 'pi_old', amount_cents: 1200 })
    expect(mocks.invoicePaymentsList).not.toHaveBeenCalled()
  })

  it('basil with invoice.payments in the payload: no API call needed', async () => {
    await deliver('invoice.paid', {
      ...invoiceBase, parent: { subscription_details: { subscription: 'sub_1', metadata: proMeta } }, total_taxes: [{ amount: 99 }],
      payments: { data: [{ status: 'paid', payment: { type: 'payment_intent', payment_intent: 'pi_basil' } }] },
    })
    expect(ledger()[0]).toMatchObject({ stripe_payment_intent_id: 'pi_basil' })
    expect(mocks.invoicePaymentsList).not.toHaveBeenCalled()
  })

  it('basil without payments: one InvoicePayments lookup by invoice, pinned to the basil API version', async () => {
    mocks.invoicePaymentsList.mockResolvedValue({ data: [{ status: 'paid', payment: { type: 'payment_intent', payment_intent: 'pi_looked' } }] })
    await deliver('invoice.paid', { ...invoiceBase, parent: { subscription_details: { subscription: 'sub_1', metadata: proMeta } } })
    expect(mocks.invoicePaymentsList).toHaveBeenCalledWith(expect.objectContaining({ invoice: 'in_1' }), expect.objectContaining({ apiVersion: '2025-03-31.basil' }))
    expect(ledger()[0].stripe_payment_intent_id).toBe('pi_looked')
  })

  it('the lookup fails: the revenue row is still recorded (without the PI) and the event completes', async () => {
    mocks.invoicePaymentsList.mockRejectedValue(new Error('stripe 400'))
    const res = await deliver('invoice.paid', { ...invoiceBase, parent: { subscription_details: { subscription: 'sub_1', metadata: proMeta } } })
    expect(res.status).toBe(200)
    expect(ledger()).toHaveLength(1)
    expect(ledger()[0].stripe_payment_intent_id).toBeNull()
  })

  it('helper: reads old and basil shapes, prefers a paid payment', () => {
    expect(invoicePaymentIntentId({ payment_intent: 'pi_a' } as any)).toBe('pi_a')
    expect(invoicePaymentIntentId({ payments: { data: [
      { status: 'open', payment: { payment_intent: 'pi_open' } },
      { status: 'paid', payment: { payment_intent: 'pi_paid' } },
    ] } } as any)).toBe('pi_paid')
    expect(invoicePaymentIntentId({} as any)).toBeNull()
  })
})

// ── N1 / F9: refunds and disputes find the row ───────────────────────────────
describe('N1: charge.refunded / dispute.created reduce the ledger in either shape', () => {
  const seed = (extra: Record<string, unknown> = {}) => {
    db.rows('pro_revenue_ledger').push({
      stripe_invoice_id: 'in_pro', stripe_payment_intent_id: 'pi_pro', amount_cents: 1299, refunded_cents: 0, disputed_cents: 0, month: '2026-10', ...extra,
    })
  }

  it('old shape: charge.invoice matches by invoice id, no payment-intent or API lookup', async () => {
    seed()
    await deliver('charge.refunded', { id: 'ch_1', invoice: 'in_pro', amount: 1299, amount_refunded: 500, payment_intent: 'pi_pro' })
    expect(ledger()[0].refunded_cents).toBe(500)
    expect(mocks.invoicePaymentsList).not.toHaveBeenCalled()
  })

  it('basil: the charge has no invoice, the row is matched by payment intent (no API call)', async () => {
    seed()
    const res = await deliver('charge.refunded', { id: 'ch_1', amount: 1299, amount_refunded: 1299, refunded: true, payment_intent: 'pi_pro' })
    expect(res.status).toBe(200)
    expect(ledger()[0].refunded_cents).toBe(1299)
    expect(mocks.invoicePaymentsList).not.toHaveBeenCalled()
  })

  it('basil dispute.created: matched by payment intent through the retrieved charge', async () => {
    seed()
    mocks.chargesRetrieve.mockResolvedValue({ id: 'ch_1', payment_intent: 'pi_pro' })
    await deliver('charge.dispute.created', { id: 'dp_1', amount: 1299, payment_intent: 'pi_pro', charge: 'ch_1' })
    expect(ledger()[0].disputed_cents).toBe(1299)
  })

  it('last resort: no invoice on the charge and no PI on the row -> InvoicePayments lookup finds it', async () => {
    seed({ stripe_payment_intent_id: null })
    mocks.invoicePaymentsList.mockResolvedValue({ data: [{ invoice: 'in_pro' }] })
    await deliver('charge.refunded', { id: 'ch_1', amount: 1299, amount_refunded: 300, payment_intent: 'pi_pro' })
    expect(mocks.invoicePaymentsList).toHaveBeenCalledTimes(1)
    expect(ledger()[0].refunded_cents).toBe(300)
  })

  it('a charge that matches nothing is a no-op: ledger untouched, event completes', async () => {
    seed()
    const res = await deliver('charge.refunded', { id: 'ch_9', amount: 500, amount_refunded: 500, refunded: true, payment_intent: 'pi_other' })
    expect(res.status).toBe(200)
    expect(ledger()[0]).toMatchObject({ refunded_cents: 0, disputed_cents: 0 })
    expect(db.rows('stripe_events')[0].status).toBe('completed')
  })

  it('the last-resort lookup throws: the event still completes (token reversal is not blocked)', async () => {
    mocks.invoicePaymentsList.mockRejectedValue(new Error('stripe 400'))
    mocks.sessionsList.mockResolvedValue({ data: [{ id: 'cs_t', amount_total: 1000, metadata: { userId: 'u1', checkoutMode: 'token_purchase', tokenAmount: '1000' } }] })
    db.rows('hapi_tokens').push({ user_id: 'u1', balance: 1000 })
    const res = await deliver('charge.refunded', { id: 'ch_t', amount: 1000, amount_refunded: 1000, refunded: true, payment_intent: 'pi_t' })
    expect(res.status).toBe(200)
    expect(db.tokens('u1')).toBe(0) // the token clawback ran
  })

  it('a replay changes nothing', async () => {
    seed()
    const charge = { id: 'ch_1', amount: 1299, amount_refunded: 300, payment_intent: 'pi_pro' }
    await deliver('charge.refunded', charge)
    await deliver('charge.refunded', charge, 'evt_replay')
    expect(ledger()[0].refunded_cents).toBe(300)
  })
})

// ── S3: dispute closed ───────────────────────────────────────────────────────
describe('S3: charge.dispute.closed', () => {
  const PI = 'pi_tok'
  const key = `stripe:pi:${PI}:token-reversal`

  beforeEach(() => {
    db.rows('hapi_tokens').push({ user_id: 'u1', balance: 1000 })
    db.rows('pro_revenue_ledger').push({ stripe_invoice_id: 'in_pro', stripe_payment_intent_id: PI, amount_cents: 1000, refunded_cents: 0, disputed_cents: 0, month: '2026-10' })
    mocks.sessionsList.mockResolvedValue({ data: [{ id: 'cs_t', amount_total: 1000, metadata: { userId: 'u1', checkoutMode: 'token_purchase', tokenAmount: '1000' } }] })
    mocks.chargesRetrieve.mockResolvedValue({ id: 'ch_1', payment_intent: PI })
  })

  const opened = () => deliver('charge.dispute.created', { id: 'dp_1', amount: 1000, payment_intent: PI, charge: 'ch_1' })
  const closed = (status: string, id?: string) =>
    deliver('charge.dispute.closed', { id: 'dp_1', amount: 1000, status, payment_intent: PI, charge: 'ch_1' }, id)

  it('won: the ledger dispute is undone, the dispute share of the reversal goes to 0, tokens are NOT re-credited, a review row is written', async () => {
    await opened()
    expect(ledger()[0].disputed_cents).toBe(1000)
    expect(db.tokens('u1')).toBe(0)

    const res = await closed('won')

    expect(res.status).toBe(200)
    expect(ledger()[0].disputed_cents).toBe(0)
    expect(db.rows('token_reversals')[0]).toMatchObject({ effect_key: key, dispute_tokens: 0, reversed: 1000 })
    expect(db.tokens('u1')).toBe(0) // no automatic re-credit
    expect(db.rows('token_ledger').filter(l => l.type !== 'refund')).toHaveLength(0)
    const review = db.rows('money_exceptions').filter(r => r.kind === 'dispute_won_review')
    expect(review).toHaveLength(1)
    expect(review[0]).toMatchObject({ user_id: 'u1', amount: 1000, ref: key })
  })

  it('idempotent: the same event redelivered, and a second event for the same dispute, change nothing more', async () => {
    await opened()
    await closed('won', 'evt_closed')
    const again = await closed('won', 'evt_closed') // same event id: duplicate
    const other = await closed('won', 'evt_closed_2') // new event id, same dispute
    expect(again.status).toBe(200)
    expect(other.status).toBe(200)
    expect(db.rows('money_exceptions').filter(r => r.kind === 'dispute_won_review')).toHaveLength(1)
    expect(db.rows('token_reversals')[0].dispute_tokens).toBe(0)
    expect(ledger()[0].disputed_cents).toBe(0)
  })

  it('lost: everything from dispute.created stays as it was', async () => {
    await opened()
    await closed('lost')
    expect(ledger()[0].disputed_cents).toBe(1000)
    expect(db.rows('token_reversals')[0].dispute_tokens).toBe(1000)
    expect(db.rows('money_exceptions').filter(r => r.kind === 'dispute_won_review')).toHaveLength(0)
  })

  it('won, but the dispute never reversed any tokens: ledger reset, no review row', async () => {
    // no dispute.created was processed for tokens (e.g. a Pro-only charge)
    db.rows('pro_revenue_ledger')[0].disputed_cents = 1000
    mocks.sessionsList.mockResolvedValue({ data: [] })
    const res = await closed('won')
    expect(res.status).toBe(200)
    expect(ledger()[0].disputed_cents).toBe(0)
    expect(db.rows('money_exceptions')).toHaveLength(0)
  })

  it('won, a dispute that matches nothing at all, is a no-op', async () => {
    const res = await deliver('charge.dispute.closed', { id: 'dp_x', amount: 5, status: 'won', payment_intent: 'pi_nobody', charge: 'ch_x' })
    expect(res.status).toBe(200)
    expect(ledger()[0].disputed_cents).toBe(0)
    expect(db.rows('money_exceptions')).toHaveLength(0)
  })
})
