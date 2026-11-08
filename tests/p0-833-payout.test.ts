import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MoneyDb } from './helpers/fake-money-db'

// #833 fix 4: the Pro creator payout uses recorded revenue, is atomic, and re-runs are no-ops.

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createServiceClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
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

import { POST as payoutRun } from '@/app/api/academy/payout/run/route'
import { POST as stripeWebhook } from '@/app/api/stripe/webhook/route'

const X = 'creator-x'
const Y = 'creator-y'
let db: MoneyDb

const seed = () => ({
  // 100 active subs: the OLD code would have paid out 100 x $12.99 x 50% regardless of what Stripe collected
  pro_subscriptions: Array.from({ length: 100 }, (_, i) => ({ id: `s${i}`, status: 'active' })),
  pro_revenue_ledger: [
    { stripe_invoice_id: 'in_A', amount_cents: 1299, refunded_cents: 0, month: '2026-10' },
    { stripe_invoice_id: 'in_B', amount_cents: 1299, refunded_cents: 500, month: '2026-10' },
    { stripe_invoice_id: 'in_other_month', amount_cents: 9999, refunded_cents: 0, month: '2026-09' },
  ],
  academy_engagement: [
    { creator_id: X, minutes: 60, completed: true, month: '2026-10', via_pro: true }, // 80 credits
    { creator_id: Y, minutes: 20, completed: false, month: '2026-10', via_pro: true }, // 20 credits
    { creator_id: Y, minutes: 999, completed: true, month: '2026-10', via_pro: false }, // not Pro-sourced: ignored
  ],
})

const run = (month = '2026-10') =>
  payoutRun(new NextRequest('http://localhost/api/academy/payout/run', {
    method: 'POST',
    headers: { 'x-cron-secret': 'cron_test_secret' },
    body: JSON.stringify({ month }),
  }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  process.env.CRON_SECRET = 'cron_test_secret'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_not_a_real_secret'
  db = new MoneyDb(seed())
  mocks.createServiceClient.mockReturnValue(db)
})

describe('pro payout', () => {
  it('(1) pays from recorded, refund-adjusted invoice revenue — not subscribers x price', async () => {
    const res = await run()
    const json = await res.json()

    // gross = 1299 + (1299 - 500) = 2098 ; pool = 50% = 1049 ; split 80:20
    expect(res.status).toBe(200)
    expect(json).toMatchObject({ source: 'recorded_invoices', invoicesCounted: 2, grossCents: 2098, poolCents: 1049 })
    expect(db.creatorCents(X)).toBe(Math.floor((1049 * 80) / 100)) // 839
    expect(db.creatorCents(Y)).toBe(Math.floor((1049 * 20) / 100)) // 209
    expect(db.rows('pro_payout_pool')[0]).toMatchObject({ month: '2026-10', gross_cents: 2098, distributed: true })
  })

  it('(2) re-running a distributed month is a no-op', async () => {
    await run()
    const again = await run()

    expect(await again.json()).toMatchObject({ skipped: true })
    expect(db.creatorCents(X)).toBe(839)
    expect(db.creatorCents(Y)).toBe(209)
  })

  it('(3) two concurrent runs pay once', async () => {
    await Promise.all([run(), run()])

    expect(db.creatorCents(X)).toBe(839)
    expect(db.creatorCents(Y)).toBe(209)
  })

  it('(4) a failure commits nothing and the pool is not marked distributed; the re-run then pays', async () => {
    db.faultRpc('run_pro_payout', 'before')

    const failed = await run()
    expect(failed.status).toBe(500)
    expect(db.creatorCents(X)).toBe(0)
    expect(db.rows('pro_payout_pool').some(p => p.distributed)).toBe(false)

    expect((await run()).status).toBe(200)
    expect(db.creatorCents(X)).toBe(839)
  })

  it('(5) commit succeeded but the response was lost: the re-run does not pay again', async () => {
    db.faultRpc('run_pro_payout', 'after')

    expect((await run()).status).toBe(500)
    const again = await run()

    expect(await again.json()).toMatchObject({ skipped: true })
    expect(db.creatorCents(X)).toBe(839)
    expect(db.creatorCents(Y)).toBe(209)
  })

  it('(6) a month that has not finished is refused', async () => {
    const res = await run(new Date().toISOString().slice(0, 7))

    expect(res.status).toBe(400)
    expect(db.creatorCents(X)).toBe(0)
  })

  it('(7) a month with no recorded invoices is refused (409) and NOT locked, so a backfill can still be paid', async () => {
    db.rows('pro_revenue_ledger').length = 0

    const res = await run()

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ invoicesCounted: 0 })
    expect(db.creatorCents(X)).toBe(0)
    expect(db.rows('pro_payout_pool').some(p => p.distributed)).toBe(false)

    // backfill arrives -> the same month now pays
    db.rows('pro_revenue_ledger').push({ stripe_invoice_id: 'in_backfill', amount_cents: 1000, refunded_cents: 0, month: '2026-10' })
    expect((await run()).status).toBe(200)
    expect(db.creatorCents(X)).toBe(Math.floor((500 * 80) / 100))
  })

  it('(7b) the SQL function itself also refuses an empty ledger (route bypassed) without flagging the month', async () => {
    db.rows('pro_revenue_ledger').length = 0

    const { data } = await db.rpc('run_pro_payout', { p_month: '2026-10', p_expected_gross: 0, p_pool_cents: 0, p_total_credits: 0, p_earnings: [] })

    expect(data).toMatchObject({ status: 'no_invoices' })
    expect(db.rows('pro_payout_pool').some(p => p.distributed)).toBe(false)
  })

  it('(7c) run_pro_payout rejects a split larger than the pool, or a pool larger than gross, and pays nothing', async () => {
    const over = await db.rpc('run_pro_payout', {
      p_month: '2026-10', p_expected_gross: 2098, p_pool_cents: 1049, p_total_credits: 100,
      p_earnings: [{ creator_id: X, credits: 80, cents: 1000 }, { creator_id: Y, credits: 20, cents: 500 }],
    })
    expect(over.error?.message).toContain('BAD_SPLIT')

    const pool = await db.rpc('run_pro_payout', {
      p_month: '2026-10', p_expected_gross: 2098, p_pool_cents: 5000, p_total_credits: 100, p_earnings: [],
    })
    expect(pool.error?.message).toContain('BAD_SPLIT')

    expect(db.creatorCents(X)).toBe(0)
    expect(db.rows('pro_payout_pool').some(p => p.distributed)).toBe(false)
  })
})

describe('pro revenue ledger (webhook)', () => {
  const invoicePaid = (eventId: string, over: Record<string, unknown> = {}) =>
    stripeWebhook(new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: JSON.stringify({
        id: eventId,
        type: 'invoice.paid',
        data: { object: {
          id: 'in_new', subscription: 'sub_1', amount_paid: 1299, tax: 99, created: Date.parse('2026-10-15T00:00:00Z') / 1000,
          status_transitions: { paid_at: Date.parse('2026-10-15T00:00:00Z') / 1000 }, currency: 'usd',
          subscription_details: { metadata: { kind: 'pro_subscription', user_id: 'u1' } }, ...over,
        } },
      }),
    }))

  it('(8) records a paid Pro invoice once, excluding tax, under its UTC month', async () => {
    db = new MoneyDb()
    mocks.createServiceClient.mockReturnValue(db)

    expect((await invoicePaid('evt_1')).status).toBe(200)
    expect((await invoicePaid('evt_2')).status).toBe(200) // same invoice, different event id

    expect(db.rows('pro_revenue_ledger')).toHaveLength(1)
    expect(db.rows('pro_revenue_ledger')[0]).toMatchObject({ stripe_invoice_id: 'in_new', amount_cents: 1200, month: '2026-10' })
  })

  it('(9) ignores invoices that are not Pro subscriptions', async () => {
    db = new MoneyDb()
    mocks.createServiceClient.mockReturnValue(db)

    await invoicePaid('evt_3', { subscription: 'sub_creator_channel', subscription_details: { metadata: { userId: 'u', channelId: 'c' } } })

    expect(db.rows('pro_revenue_ledger')).toHaveLength(0)
  })
})
