import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MoneyDb } from './helpers/fake-money-db'

// #833 round 3, findings 9 and 14: the webhook reads invoice / charge fields in both the pre-basil and
// the basil (2025-03-31+) payload shapes, and Pro subscription events never touch platform subscription fields.

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  sessionsList: vi.fn(),
  chargesRetrieve: vi.fn(),
  invoicePaymentsList: vi.fn(),
  customersRetrieve: vi.fn(),
  handleProSub: vi.fn(),
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
    subscriptions: { retrieve: vi.fn() },
  },
}))
vi.mock('@/lib/academy/pro', () => ({
  handleProCheckoutCompleted: vi.fn(),
  handleProSubscriptionEvent: mocks.handleProSub,
}))

import { POST } from '@/app/api/stripe/webhook/route'

let db: MoneyDb
let seq = 0
const deliver = (type: string, object: Record<string, unknown>) =>
  POST(new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: JSON.stringify({ id: `evt_${++seq}`, type, data: { object } }),
  }))

const paidAt = Date.parse('2026-10-15T00:00:00Z') / 1000
const base = { id: 'in_1', amount_paid: 1299, currency: 'usd', created: paidAt, status_transitions: { paid_at: paidAt } }

beforeEach(() => {
  vi.clearAllMocks()
  seq = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_not_a_real_secret'
  db = new MoneyDb()
  mocks.createServiceClient.mockReturnValue(db)
  mocks.sessionsList.mockResolvedValue({ data: [] })
})

describe('invoice.paid records Pro revenue in either payload shape (finding 9)', () => {
  it('pre-basil shape: invoice.subscription, invoice.subscription_details, invoice.tax', async () => {
    const res = await deliver('invoice.paid', {
      ...base, subscription: 'sub_1', tax: 99,
      subscription_details: { metadata: { kind: 'pro_subscription', user_id: 'u1' } },
    })

    expect(res.status).toBe(200)
    expect(db.rows('pro_revenue_ledger')).toHaveLength(1)
    expect(db.rows('pro_revenue_ledger')[0]).toMatchObject({
      stripe_invoice_id: 'in_1', amount_cents: 1200, stripe_subscription_id: 'sub_1', user_id: 'u1', month: '2026-10',
    })
  })

  it('basil shape: invoice.parent.subscription_details and total_taxes', async () => {
    const res = await deliver('invoice.paid', {
      ...base,
      parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_1', metadata: { kind: 'pro_subscription', user_id: 'u1' } } },
      total_taxes: [{ amount: 60, tax_behavior: 'exclusive' }, { amount: 39, tax_behavior: 'exclusive' }],
    })

    expect(res.status).toBe(200)
    expect(db.rows('pro_revenue_ledger')).toHaveLength(1)
    expect(db.rows('pro_revenue_ledger')[0]).toMatchObject({
      stripe_invoice_id: 'in_1', amount_cents: 1200, stripe_subscription_id: 'sub_1', user_id: 'u1',
    })
  })

  it('basil shape without metadata falls back to the pro_subscriptions row for the subscription id', async () => {
    db = new MoneyDb({ pro_subscriptions: [{ user_id: 'u1', stripe_subscription_id: 'sub_9' }] })
    mocks.createServiceClient.mockReturnValue(db)

    await deliver('invoice.paid', { ...base, parent: { subscription_details: { subscription: 'sub_9' } }, total_taxes: [] })

    expect(db.rows('pro_revenue_ledger')).toHaveLength(1)
    expect(db.rows('pro_revenue_ledger')[0]).toMatchObject({ amount_cents: 1299, stripe_subscription_id: 'sub_9' })
  })

  it('a non-Pro invoice records nothing in either shape', async () => {
    await deliver('invoice.paid', { ...base, subscription: 'sub_other', tax: 0 })
    await deliver('invoice.paid', { ...base, id: 'in_2', parent: { subscription_details: { subscription: 'sub_other' } } })
    expect(db.rows('pro_revenue_ledger')).toHaveLength(0)
  })
})

describe('charge.refunded finds the Pro invoice in either payload shape (finding 9)', () => {
  const seedLedger = () => {
    db = new MoneyDb({ pro_revenue_ledger: [{ stripe_invoice_id: 'in_pro', amount_cents: 1299, refunded_cents: 0, disputed_cents: 0, month: '2026-10' }] })
    mocks.createServiceClient.mockReturnValue(db)
  }

  it('pre-basil: charge.invoice', async () => {
    seedLedger()
    await deliver('charge.refunded', { id: 'ch_1', invoice: 'in_pro', amount: 1299, amount_refunded: 500, payment_intent: 'pi_1' })
    expect(db.rows('pro_revenue_ledger')[0].refunded_cents).toBe(500)
    expect(mocks.invoicePaymentsList).not.toHaveBeenCalled()
  })

  it('basil: no charge.invoice, resolved through the invoice payment for the payment intent', async () => {
    seedLedger()
    mocks.invoicePaymentsList.mockResolvedValue({ data: [{ invoice: 'in_pro' }] })

    await deliver('charge.refunded', { id: 'ch_1', amount: 1299, amount_refunded: 1299, payment_intent: 'pi_1' })

    expect(mocks.invoicePaymentsList).toHaveBeenCalledWith(expect.objectContaining({ payment: { type: 'payment_intent', payment_intent: 'pi_1' } }))
    expect(db.rows('pro_revenue_ledger')[0].refunded_cents).toBe(1299)
  })

  it('a charge that belongs to no invoice leaves the ledger alone', async () => {
    seedLedger()
    mocks.invoicePaymentsList.mockResolvedValue({ data: [] })
    await deliver('charge.refunded', { id: 'ch_1', amount: 500, amount_refunded: 500, payment_intent: 'pi_x' })
    expect(db.rows('pro_revenue_ledger')[0].refunded_cents).toBe(0)
  })
})

describe('Pro subscription events do not overwrite platform subscription fields (finding 14)', () => {
  const sub = (type: string, metadata: Record<string, string>) =>
    deliver(type, { id: 'sub_1', status: 'active', customer: 'cus_1', current_period_end: paidAt, metadata })

  beforeEach(() => {
    db = new MoneyDb({ profiles: [{ id: 'u1', stripe_customer_id: 'cus_1', platform_subscription_id: 'sub_platform', platform_subscription_status: 'active' }] })
    mocks.createServiceClient.mockReturnValue(db)
    mocks.customersRetrieve.mockResolvedValue({ id: 'cus_1' })
  })

  it('a Pro subscription update goes to the Pro handler only', async () => {
    await sub('customer.subscription.updated', { kind: 'pro_subscription', userId: 'u1' })

    expect(mocks.handleProSub).toHaveBeenCalledTimes(1)
    expect(db.rows('profiles')[0]).toMatchObject({ platform_subscription_id: 'sub_platform', platform_subscription_status: 'active' })
  })

  it('cancelling a Pro subscription does not cancel the real platform subscription', async () => {
    await sub('customer.subscription.deleted', { kind: 'pro_subscription', userId: 'u1' })

    expect(mocks.handleProSub).toHaveBeenCalledTimes(1)
    expect(db.rows('profiles')[0].platform_subscription_status).toBe('active')
  })

  it('a genuine platform subscription (no kind, no channelId) is still updated and cancelled', async () => {
    await sub('customer.subscription.updated', { userId: 'u1' })
    expect(db.rows('profiles')[0]).toMatchObject({ platform_subscription_id: 'sub_1', platform_subscription_status: 'active' })

    await sub('customer.subscription.deleted', { userId: 'u1' })
    expect(db.rows('profiles')[0].platform_subscription_status).toBe('canceled')
    expect(mocks.handleProSub).not.toHaveBeenCalled()
  })
})
