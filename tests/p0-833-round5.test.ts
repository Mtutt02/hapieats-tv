import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MoneyDb } from './helpers/fake-money-db'

// #833 round 5 (Fable review): P1 fulfil vs restore on a partial-credit PPV checkout, P3 RevenueCat
// sandbox events, P4 creator payout request is atomic. (P0, the direct-write lockdown, is SQL: see
// supabase/sqltest/test5.mjs.)

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  sessionsCreate: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient, createServiceClient: mocks.createServiceClient }))
vi.mock('next/headers', () => ({ headers: () => ({ get: () => 'sig_test' }) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => ({ allowed: true }) }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: (body: string) => JSON.parse(body) },
    checkout: { sessions: { create: mocks.sessionsCreate, list: vi.fn(async () => ({ data: [] })) } },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    subscriptions: { retrieve: vi.fn() },
  },
}))

import { POST as stripeWebhook } from '@/app/api/stripe/webhook/route'
import { POST as creditsCheckout } from '@/app/api/credits/checkout/route'
import { POST as revenuecat } from '@/app/api/iap/revenuecat-webhook/route'
import { POST as requestPayout } from '@/app/api/creator/wallet/route'

const USER = 'user-1'
const VIDEO = 'vid-1'
let db: MoneyDb
let seq = 0

const gift = () => Number(db.rows('app_credits')[0].gift_balance)
const loan = () => Number(db.rows('app_credits')[0].loan_balance)

const checkout = () =>
  creditsCheckout(new NextRequest('http://localhost/api/credits/checkout', { method: 'POST', body: JSON.stringify({ mode: 'ppv', videoId: VIDEO }) }))

const webhook = (type: string, metadata: Record<string, string>, over: Record<string, unknown> = {}, id = `evt_${++seq}`) =>
  stripeWebhook(new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: JSON.stringify({
      id, type,
      data: { object: { id: 'cs_1', payment_status: 'paid', payment_intent: 'pi_1', amount_total: 500, metadata, ...over } },
    }),
  }))

beforeEach(() => {
  vi.clearAllMocks()
  seq = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_not_a_real_secret'
  delete process.env.CREATOR_PAYOUTS_PAUSED
  delete process.env.PAYMENTS_PAUSED
  db = new MoneyDb({
    app_credits: [{ user_id: USER, gift_balance: '4.00', loan_balance: '1.00', loan_repaid: '0' }],
    videos: [{ id: VIDEO, title: 'Paid class', price: '10.00' }],
    profiles: [{ id: USER, stripe_customer_id: 'cus_1' }],
  })
  mocks.createServiceClient.mockReturnValue(db)
  mocks.createClient.mockReturnValue({
    auth: { getUser: async () => ({ data: { user: { id: USER, email: 'u@example.com' } } }) },
    from: db.from,
  })
  mocks.sessionsCreate.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' })
})
afterEach(() => { vi.unstubAllEnvs() })

// ── P1 ───────────────────────────────────────────────────────────────────────
describe('P1: a partial-credit PPV can never end with the video AND the credits', () => {
  const startCheckout = async () => {
    const res = await checkout()
    expect(res!.status).toBe(200)
    return mocks.sessionsCreate.mock.calls[0][0].metadata as Record<string, string>
  }
  const settleLikeTheSweeper = () => db.rpc('peek_credit_checkout', { p_buyer: USER, p_video: VIDEO })

  it('the review scenario: completed webhook fails once, the credits are restored, Stripe retries -> video kept, credits taken again', async () => {
    const meta = await startCheckout()
    expect(gift() + loan()).toBe(0) // 4 + 1 debited

    db.faultRpc('fulfil_credit_ppv', 'before') // DB blip: checkout.session.completed 500s
    const first = await webhook('checkout.session.completed', { ...meta, userId: USER }, {}, 'evt_paid')
    expect(first.status).toBe(500)
    expect(db.rows('purchases')).toHaveLength(0)

    db.now += 36 * 60 * 1000 // minute 35: the buyer taps Buy again / the sweeper runs
    await settleLikeTheSweeper()
    expect(gift()).toBe(4) // credits are back (nobody knew the payment had landed)
    expect(loan()).toBe(1)

    const retry = await webhook('checkout.session.completed', { ...meta, userId: USER }, {}, 'evt_paid') // Stripe's retry, same event id
    expect(retry.status).toBe(200)
    expect(db.rows('purchases')).toHaveLength(1)
    expect(db.rows('purchases')[0]).toMatchObject({ buyer_id: USER, video_id: VIDEO, credit_funded: true })
    expect(gift()).toBe(0) // ...and the credits are gone again: the buyer paid for the video, once
    expect(loan()).toBe(0)
    expect(db.rows('credit_checkout_outcomes')[0]).toMatchObject({ outcome: 'fulfilled_after_restore' })
    expect(db.rows('money_exceptions')).toHaveLength(0)
  })

  it('same, but the buyer already spent the restored credits: video delivered, the missing amount is logged for review', async () => {
    const meta = await startCheckout()
    db.faultRpc('fulfil_credit_ppv', 'before')
    await webhook('checkout.session.completed', { ...meta, userId: USER }, {}, 'evt_paid')
    db.now += 36 * 60 * 1000
    await settleLikeTheSweeper()
    db.rows('app_credits')[0].gift_balance = '1.00' // spent 3 gift + 1 loan elsewhere
    db.rows('app_credits')[0].loan_balance = '0.00'

    const retry = await webhook('checkout.session.completed', { ...meta, userId: USER }, {}, 'evt_paid')
    expect(retry.status).toBe(200)
    expect(db.rows('purchases')).toHaveLength(1)
    expect(gift()).toBe(0)
    expect(loan()).toBe(0)
    expect(db.rows('money_exceptions')).toHaveLength(1)
    expect(db.rows('money_exceptions')[0]).toMatchObject({ kind: 'restored_then_paid', user_id: USER, amount: 4 })
  })

  it('fulfilled first, then the abandoned-checkout restore arrives (expired event replay / sweeper): credits are NOT given back', async () => {
    const meta = await startCheckout()
    const paid = await webhook('checkout.session.completed', { ...meta, userId: USER })
    expect(paid.status).toBe(200)
    expect(db.rows('purchases')).toHaveLength(1)

    const expired = await webhook('checkout.session.expired', { ...meta, userId: USER })
    expect(expired.status).toBe(200)
    expect(gift() + loan()).toBe(0) // still spent
    expect(db.rows('credit_ledger').filter(l => l.entry_type === 'restore_credit')).toHaveLength(0)

    db.now += 36 * 60 * 1000
    await settleLikeTheSweeper()
    expect(gift() + loan()).toBe(0)
  })

  it('a plain paid checkout: one purchase, credits stay spent, no re-debit, a replayed webhook changes nothing', async () => {
    const meta = await startCheckout()
    await webhook('checkout.session.completed', { ...meta, userId: USER }, {}, 'evt_a')
    await webhook('checkout.session.completed', { ...meta, userId: USER }, {}, 'evt_b') // a second delivery with another event id
    expect(db.rows('purchases')).toHaveLength(1)
    expect(db.rows('credit_checkout_outcomes')[0].outcome).toBe('fulfilled')
    expect(gift() + loan()).toBe(0)
    expect(db.rows('credit_ledger').filter(l => l.entry_type.startsWith('spend'))).toHaveLength(2) // the original 4 + 1, nothing added
  })

  it('an abandoned checkout (session expired, never paid) still gets its credits back, once', async () => {
    const meta = await startCheckout()
    await webhook('checkout.session.expired', { ...meta, userId: USER, }, { payment_status: 'unpaid' })
    expect(gift()).toBe(4)
    expect(loan()).toBe(1)
    await webhook('checkout.session.expired', { ...meta, userId: USER }, { payment_status: 'unpaid' })
    expect(gift()).toBe(4)
  })

  it('the fulfilment RPC failing is a 500 (Stripe retries) - never a silent "continue anyway"', async () => {
    const meta = await startCheckout()
    db.faultRpc('fulfil_credit_ppv', 'before')
    const res = await webhook('checkout.session.completed', { ...meta, userId: USER })
    expect(res.status).toBe(500)
    expect(db.rows('purchases')).toHaveLength(0)
  })

  it('a session from before checkoutRef existed (no ref) is still fulfilled with the old direct upsert', async () => {
    const res = await webhook('checkout.session.completed', { userId: USER, checkoutMode: 'credit_ppv', videoId: VIDEO, giftUsed: '4', loanUsed: '1' })
    expect(res.status).toBe(200)
    expect(db.rows('purchases')).toHaveLength(1)
  })
})

// ── P3 ───────────────────────────────────────────────────────────────────────
describe('P3: RevenueCat sandbox / TestFlight events never credit real tokens', () => {
  const SECRET = 'rc_test_secret_value'
  const UID = '11111111-1111-4111-8111-111111111111'
  const deliver = (event: Record<string, unknown>) =>
    revenuecat(new NextRequest('http://localhost/api/iap/revenuecat-webhook', {
      method: 'POST',
      headers: { authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ event: { id: 'rc_1', type: 'NON_RENEWING_PURCHASE', app_user_id: UID, product_id: 'hapi_tokens_5000', store: 'APP_STORE', transaction_id: 'txn_1', ...event } }),
    }))
  beforeEach(() => { process.env.REVENUECAT_WEBHOOK_SECRET = SECRET })

  it('production deployment + environment SANDBOX: 200, nothing credited, no ledger row, no event row', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = await deliver({ environment: 'SANDBOX' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, skipped: 'sandbox' })
    expect(db.tokens(UID)).toBe(0)
    expect(db.rows('token_ledger')).toHaveLength(0)
    expect(db.rows('iap_events')).toHaveLength(0)
  })

  it('production deployment + environment PRODUCTION: credited as before', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = await deliver({ environment: 'PRODUCTION' })
    expect(res.status).toBe(200)
    expect(db.tokens(UID)).toBe(5000)
  })

  it('the environment value is matched case-insensitively and anything that is not PRODUCTION is skipped', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    for (const environment of ['sandbox', 'Sandbox', 'STAGING']) {
      const res = await deliver({ environment, id: `rc_${environment}` })
      expect((await res.json()).skipped).toBe('sandbox')
    }
    expect(db.tokens(UID)).toBe(0)
  })

  it('a sandbox Creator Pro activation does not touch the profile either', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    db.rows('profiles').push({ id: UID, platform_subscription_status: 'none' })
    const res = await deliver({ environment: 'SANDBOX', type: 'INITIAL_PURCHASE', product_id: 'creator_pro_monthly' })
    expect((await res.json()).skipped).toBe('sandbox')
    expect(db.rows('profiles').find(p => p.id === UID)?.platform_subscription_status).toBe('none')
  })

  it('a sandbox REFUND is skipped too (it never had tokens to claw back)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = await deliver({ environment: 'SANDBOX', type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT' })
    expect((await res.json()).skipped).toBe('sandbox')
    expect(db.rows('token_reversals')).toHaveLength(0)
  })

  it('outside production (dev / test builds) sandbox events still credit, so the purchase flow can be tested', async () => {
    const res = await deliver({ environment: 'SANDBOX' }) // vitest runs with NODE_ENV=test
    expect(res.status).toBe(200)
    expect(db.tokens(UID)).toBe(5000)
  })

  it('an event with no environment field is processed as before (RevenueCat always sends it; documented)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = await deliver({})
    expect(res.status).toBe(200)
    expect(db.tokens(UID)).toBe(5000)
  })
})

// ── P4 ───────────────────────────────────────────────────────────────────────
describe('P4: a creator payout request is atomic', () => {
  const payout = (amount_cents = 1000) =>
    requestPayout(new NextRequest('http://localhost/api/creator/wallet', { method: 'POST', body: JSON.stringify({ amount_cents }) }))
  beforeEach(() => {
    db.rows('creator_wallets').push({
      creator_id: USER, tokens_received: 0, redeemable_cents: 1000, lifetime_earnings_cents: 1000,
      payout_status: 'none', stripe_connect_id: 'acct_test',
    })
  })

  it('two simultaneous requests for the same balance: ONE succeeds, the other gets 409, the balance drops once, one request is logged', async () => {
    const [a, b] = await Promise.all([payout(), payout()])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    expect(db.creatorCents(USER)).toBe(0)
    expect(db.rows('creator_wallets')[0].payout_status).toBe('pending')
    expect(db.rows('token_ledger').filter(l => l.metadata?.type === 'payout_request')).toHaveLength(1)
  })

  it('five simultaneous requests: still exactly one', async () => {
    const res = await Promise.all([1, 2, 3, 4, 5].map(() => payout(400)))
    expect(res.filter(r => r.status === 200)).toHaveLength(1)
    expect(db.creatorCents(USER)).toBe(600)
  })

  it('maps each outcome: below minimum 400, more than balance 402 + available, no Stripe account 402, no wallet 404', async () => {
    expect((await payout(50)).status).toBe(400)

    const tooMuch = await payout(5000)
    expect(tooMuch.status).toBe(402)
    expect(await tooMuch.json()).toMatchObject({ error: 'Insufficient redeemable balance', available: 1000 })

    db.rows('creator_wallets')[0].stripe_connect_id = null
    const noStripe = await payout(500)
    expect(noStripe.status).toBe(402)
    expect(await noStripe.json()).toMatchObject({ stripe_required: true })
    expect(db.creatorCents(USER)).toBe(1000)

    db.rows('creator_wallets').length = 0
    expect((await payout(500)).status).toBe(404)
  })

  it('a successful request answers the amount and leaves the wallet pending', async () => {
    const res = await payout(600)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, payout_requested_cents: 600 })
    expect(db.rows('creator_wallets')[0]).toMatchObject({ payout_status: 'pending', redeemable_cents: 400 })
  })

  it('the RPC failing is a 500, never a half-written wallet', async () => {
    db.faultRpc('request_creator_payout', 'before')
    const res = await payout()
    expect(res.status).toBe(500)
    expect(db.creatorCents(USER)).toBe(1000)
  })

  it('still refused while payouts are paused', async () => {
    process.env.CREATOR_PAYOUTS_PAUSED = '1'
    expect((await payout()).status).toBe(503)
    expect(db.creatorCents(USER)).toBe(1000)
  })
})
