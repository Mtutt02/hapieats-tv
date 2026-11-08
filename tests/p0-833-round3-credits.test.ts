import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MoneyDb } from './helpers/fake-money-db'

// #833 round 3: finding 5 (one restore key shared by route and webhook, idempotent session create),
// finding 6 (a failed restore is persisted for review), finding 21 (no debit for an owned video).

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  sessionsCreate: vi.fn(),
  customersCreate: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient, createServiceClient: mocks.createServiceClient }))
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
let seq = 0

const gift = () => Number(db.rows('app_credits')[0].gift_balance)
const loan = () => Number(db.rows('app_credits')[0].loan_balance)

const checkout = (body: Record<string, unknown> = { mode: 'ppv', videoId: 'vid-1' }) =>
  creditsCheckout(new NextRequest('http://localhost/api/credits/checkout', { method: 'POST', body: JSON.stringify(body) }))

const webhook = (type: string, metadata: Record<string, string>, sessionId = 'cs_orphan') =>
  stripeWebhook(new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: JSON.stringify({ id: `evt_${++seq}`, type, data: { object: { id: sessionId, metadata } } }),
  }))

beforeEach(() => {
  vi.clearAllMocks()
  seq = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_not_a_real_secret'
  db = new MoneyDb({
    app_credits: [{ user_id: USER, gift_balance: '4.00', loan_balance: '1.00', loan_repaid: '0' }],
    videos: [{ id: 'vid-1', title: 'Paid class', price: '10.00' }],
    profiles: [{ id: USER, stripe_customer_id: 'cus_1' }],
  })
  mocks.createServiceClient.mockReturnValue(db)
  mocks.createClient.mockReturnValue({
    auth: { getUser: async () => ({ data: { user: { id: USER, email: 'u@example.com' } } }) },
    from: db.from,
  })
})

describe('finding 5: one restore key for the route and the webhook', () => {
  it('sessions.create times out but Stripe made the session: route restores, the later expiry does not restore again', async () => {
    mocks.sessionsCreate.mockRejectedValue(new Error('timeout'))

    const res = await checkout()
    expect(res!.status).toBe(502)
    expect(gift()).toBe(4) // restored by the route
    expect(loan()).toBe(1)

    // The orphan session exists at Stripe with the metadata the route sent. 31 minutes later it expires.
    const sent = mocks.sessionsCreate.mock.calls[0][0]
    expect(sent.metadata.checkoutRef).toBeTruthy()
    const expiry = await webhook('checkout.session.expired', {
      userId: USER, checkoutMode: 'credit_ppv', videoId: 'vid-1', giftUsed: '4', loanUsed: '1', checkoutRef: sent.metadata.checkoutRef,
    })

    expect(expiry.status).toBe(200)
    expect(gift()).toBe(4) // NOT 8
    expect(loan()).toBe(1) // NOT 2
    expect(db.rows('credit_ledger').filter(l => l.entry_type === 'restore_credit')).toHaveLength(1) // (the debit rows are spend_*)
  })

  it('the webhook restore first, then a (late) route restore for the same ref, is also once', async () => {
    db.rows('app_credits')[0].gift_balance = '0.00'
    db.rows('app_credits')[0].loan_balance = '0.00'
    await webhook('checkout.session.expired', {
      userId: USER, checkoutMode: 'credit_ppv', videoId: 'vid-1', giftUsed: '4', loanUsed: '1', checkoutRef: 'ref-1',
    })
    const again = await db.rpc('restore_credits_once', {
      p_key: 'credit-checkout:ref-1:restore', p_user_id: USER, p_gift: 4, p_loan: 1, p_ref: 'ref-1',
    })

    expect(again.data).toBe(false)
    expect(gift()).toBe(4)
    expect(db.rows('credit_ledger')).toHaveLength(1)
  })

  it('both modes pass the checkoutRef as the Stripe idempotency key and put it in the metadata', async () => {
    mocks.sessionsCreate.mockResolvedValue({ id: 'cs_new', url: 'https://checkout.stripe.test/x' })
    db.rows('flavor_packages').push({ id: 'pkg-1', name: 'Pack', points: 100, price_usd: '10.00' })

    await checkout({ mode: 'ppv', videoId: 'vid-1' })
    const [ppvArgs, ppvOpts] = mocks.sessionsCreate.mock.calls[0]
    expect(ppvOpts).toEqual({ idempotencyKey: ppvArgs.metadata.checkoutRef })
    expect(ppvArgs.payment_method_types).toEqual(['card'])

    db.rows('app_credits')[0].gift_balance = '4.00'
    db.rows('app_credits')[0].loan_balance = '1.00'
    await checkout({ mode: 'flavor', packageId: 'pkg-1' })
    const [flArgs, flOpts] = mocks.sessionsCreate.mock.calls[1]
    expect(flOpts).toEqual({ idempotencyKey: flArgs.metadata.checkoutRef })
    expect(flArgs.metadata.checkoutRef).not.toBe(ppvArgs.metadata.checkoutRef)
    expect(flArgs.payment_method_types).toEqual(['card'])
  })

  it('sessions created before checkoutRef existed still restore once under the per-session key', async () => {
    db.rows('app_credits')[0].gift_balance = '0.00'
    db.rows('app_credits')[0].loan_balance = '0.00'
    const legacy = { userId: USER, checkoutMode: 'credit_ppv', videoId: 'vid-1', giftUsed: '4', loanUsed: '1' }

    await webhook('checkout.session.expired', legacy)
    await webhook('checkout.session.async_payment_failed', legacy)

    expect(gift()).toBe(4)
    expect(db.rows('credit_ledger')).toHaveLength(1)
    expect(db.rows('money_effects').map(r => r.effect_key)).toEqual(['stripe:session:cs_orphan:credit-restore'])
  })
})

describe('finding 6: a restore that fails is persisted, not just logged', () => {
  it('writes a money_exceptions row (once, however often it is retried)', async () => {
    mocks.sessionsCreate.mockRejectedValue(new Error('stripe is down'))
    db.faultRpc('restore_credits_once', 'before', { code: 'XX000', message: 'db down during restore' })

    const res = await checkout()

    expect(res!.status).toBe(502)
    expect(gift()).toBe(0) // the restore did not happen...
    const rows = db.rows('money_exceptions')
    expect(rows).toHaveLength(1) // ...but it is on record for a human
    expect(rows[0]).toMatchObject({ kind: 'credit_restore_failed', user_id: USER, amount: 5 })
    expect(rows[0].detail).toMatchObject({ gift: 4, loan: 1, error: 'db down during restore' })
    expect(rows[0].ref).toBeTruthy()
  })

  it('a successful restore writes no exception row', async () => {
    mocks.sessionsCreate.mockRejectedValue(new Error('stripe is down'))
    await checkout()
    expect(gift()).toBe(4)
    expect(db.rows('money_exceptions')).toHaveLength(0)
  })
})

describe('finding 21: no credit debit for a video the buyer already owns', () => {
  it('returns success without touching credits when the purchase row already exists', async () => {
    db.rows('purchases').push({ buyer_id: USER, video_id: 'vid-1', amount: 0, credit_funded: true })

    const res = await checkout()

    expect(res!.status).toBe(200)
    expect(await res!.json()).toMatchObject({ success: true, mode: 'already_owned', creditsUsed: 0 })
    expect(gift()).toBe(4)
    expect(loan()).toBe(1)
    expect(db.rows('credit_ledger')).toHaveLength(0)
    expect(mocks.sessionsCreate).not.toHaveBeenCalled()
  })

  it('a video the buyer does not own is still debited and unlocked as before', async () => {
    db.rows('videos')[0].price = '3.00' // fully covered by 4.00 of gift credits

    const res = await checkout()

    expect(await res!.json()).toMatchObject({ success: true, mode: 'full_credit' })
    expect(db.rows('purchases')).toHaveLength(1)
  })
})
