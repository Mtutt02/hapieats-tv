import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MoneyDb } from './helpers/fake-money-db'

// #833 round 4: S2 (credit checkout: one open checkout per buyer+video, race-safe owned check, duplicate
// purchase rows do not 500) and N3 (paid challenge votes cannot double-charge).

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
import { POST as castVote } from '@/app/api/challenges/[id]/vote/route'

const USER = 'user-1'
const VIDEO = 'vid-1'
let db: MoneyDb
let seq = 0

const gift = () => Number(db.rows('app_credits')[0].gift_balance)
const loan = () => Number(db.rows('app_credits')[0].loan_balance)
const pending = () => db.rows('pending_credit_checkouts')

const checkout = () =>
  creditsCheckout(new NextRequest('http://localhost/api/credits/checkout', { method: 'POST', body: JSON.stringify({ mode: 'ppv', videoId: VIDEO }) }))

const webhook = (type: string, metadata: Record<string, string>, sessionId = 'cs_1') =>
  stripeWebhook(new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: JSON.stringify({ id: `evt_${++seq}`, type, data: { object: { id: sessionId, payment_status: 'paid', metadata } } }),
  }))

beforeEach(() => {
  vi.clearAllMocks()
  seq = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_not_a_real_secret'
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

describe('S2: one open credit checkout per buyer and video', () => {
  it('two simultaneous partial-credit requests: ONE debit, ONE Stripe session, the other gets 409', async () => {
    const [a, b] = await Promise.all([checkout(), checkout()])

    expect([a!.status, b!.status].sort()).toEqual([200, 409])
    expect(mocks.sessionsCreate).toHaveBeenCalledTimes(1)
    expect(gift()).toBe(0) // 4 debited once, not twice (a second debit would have failed or doubled)
    expect(loan()).toBe(0)
    expect(db.rows('credit_ledger').filter(l => l.entry_type === 'spend_gift')).toHaveLength(1)
    expect(pending()).toHaveLength(1)
    const loser = (a!.status === 409 ? a : b)!
    expect((await loser.json()).mode).toBe('in_progress')
  })

  it('a second tap after the first returned gets 409 with the Stripe URL to go back to', async () => {
    const first = await checkout()
    expect(first!.status).toBe(200)
    const second = await checkout()
    expect(second!.status).toBe(409)
    expect((await second!.json()).stripeUrl).toBe('https://checkout.stripe.test/cs_1')
    expect(mocks.sessionsCreate).toHaveBeenCalledTimes(1)
    expect(gift()).toBe(0)
  })

  it('two simultaneous FULL-credit requests: one unlock, one debit', async () => {
    db.rows('videos')[0].price = '3.00'
    const [a, b] = await Promise.all([checkout(), checkout()])

    expect([a!.status, b!.status].sort()).toEqual([200, 409])
    expect(db.rows('purchases')).toHaveLength(1)
    expect(gift() + loan()).toBe(2) // 5 - 3, charged once
    expect(db.rows('credit_ledger').filter(l => l.entry_type.startsWith('spend'))).toHaveLength(1)
    expect(pending()).toHaveLength(0) // fulfilled: claim released
  })

  it('paying: the webhook fulfils the purchase and releases the claim; a new attempt is already_owned with no debit', async () => {
    await checkout()
    const ref = mocks.sessionsCreate.mock.calls[0][0].metadata.checkoutRef
    expect(pending()).toHaveLength(1)

    await webhook('checkout.session.completed', { userId: USER, checkoutMode: 'credit_ppv', videoId: VIDEO, checkoutRef: ref })
    expect(db.rows('purchases')).toHaveLength(1)
    expect(pending()).toHaveLength(0)

    const again = await checkout()
    expect((await again!.json()).mode).toBe('already_owned')
    expect(mocks.sessionsCreate).toHaveBeenCalledTimes(1)
    expect(gift()).toBe(0) // nothing more debited
  })

  it('abandoning: session expiry restores the credits once and releases the claim, so the buyer can try again', async () => {
    await checkout()
    const meta = mocks.sessionsCreate.mock.calls[0][0].metadata
    await webhook('checkout.session.expired', { ...meta, userId: USER })
    expect(gift()).toBe(4)
    expect(loan()).toBe(1)
    expect(pending()).toHaveLength(0)

    const retry = await checkout()
    expect(retry!.status).toBe(200)
    expect(mocks.sessionsCreate).toHaveBeenCalledTimes(2)
  })

  it('Stripe session creation fails: credits restored and the claim released', async () => {
    mocks.sessionsCreate.mockRejectedValue(new Error('boom'))
    const res = await checkout()
    expect(res!.status).toBe(502)
    expect(gift()).toBe(4)
    expect(pending()).toHaveLength(0)
  })

  it('the debit itself fails: nothing reserved, the claim is released so the buyer is not locked out', async () => {
    db.failTable('app_credits', 'update')
    await expect(checkout()).rejects.toThrow()
    expect(pending()).toHaveLength(0)
    expect(mocks.sessionsCreate).not.toHaveBeenCalled()
  })

  it('a video the buyer owns (even with DUPLICATE purchase rows) is already_owned, not a 500, and is never debited', async () => {
    db.rows('purchases').push(
      { buyer_id: USER, video_id: VIDEO, amount: 0 },
      { buyer_id: USER, video_id: VIDEO, amount: 0 }, // duplicate rows: maybeSingle() used to error here
    )
    const res = await checkout()
    expect(res!.status).toBe(200)
    expect((await res!.json()).mode).toBe('already_owned')
    expect(gift()).toBe(4)
    expect(pending()).toHaveLength(0)
  })

  it('the purchase lands between the first check and the claim: caught by the re-check INSIDE the claim, no debit', async () => {
    // First owned-check sees nothing; by the time the claim is held the purchase exists.
    const realFrom = db.from
    let purchaseReads = 0
    ;(db as any).from = (table: string) => {
      if (table === 'purchases' && ++purchaseReads === 2) db.rows('purchases').push({ buyer_id: USER, video_id: VIDEO, amount: 0 })
      return realFrom(table)
    }
    const res = await checkout()
    expect((await res!.json()).mode).toBe('already_owned')
    expect(gift()).toBe(4)
    expect(mocks.sessionsCreate).not.toHaveBeenCalled()
    expect(pending()).toHaveLength(0)
  })

  it('a crashed attempt (claim + debit, no session) is settled by the next attempt once its claim expired: credits restored once', async () => {
    // simulate: attempt 1 debited and crashed before creating the session
    db.rows('app_credits')[0].gift_balance = '0.00'
    db.rows('app_credits')[0].loan_balance = '0.00'
    pending().push({ buyer_id: USER, video_id: VIDEO, checkout_ref: 'ref-crashed', gift_used: 4, loan_used: 1, session_url: null, created_at: db.now, expires_at: db.now + 1000 })
    db.rows('credit_ledger').push({ user_id: USER, entry_type: 'spend_gift', reference_id: VIDEO, reference_type: 'ppv', amount: 4 })

    // still inside the window: blocked
    const blocked = await checkout()
    expect(blocked!.status).toBe(409)

    db.now += 40 * 60 * 1000 // the claim expired
    const retry = await checkout()

    expect(retry!.status).toBe(200)
    // the crashed attempt's 4 + 1 came back, then the new attempt spent them again: net 0, ONE restore
    expect(db.rows('credit_ledger').filter(l => l.entry_type === 'restore_credit')).toHaveLength(1)
    expect(db.rows('money_effects').filter(e => e.effect_key === 'credit-checkout:ref-crashed:restore')).toHaveLength(1)
    expect(pending()).toHaveLength(1)
    expect(pending()[0].checkout_ref).not.toBe('ref-crashed')
  })
})

// ── N3 ───────────────────────────────────────────────────────────────────────
describe('N3: paid challenge votes', () => {
  const vote = (entry = 'e-1', cost = 5) =>
    castVote(
      new NextRequest('http://localhost/api/challenges/ch-1/vote', { method: 'POST', body: JSON.stringify({ entry_id: entry, tokens_to_spend: cost }) }),
      { params: { id: 'ch-1' } },
    )

  beforeEach(() => {
    db = new MoneyDb({
      hapi_tokens: [{ user_id: USER, balance: 100 }],
      challenge_entries: [
        { id: 'e-1', creator_id: 'creator-9', challenge_id: 'ch-1', status: 'approved' },
        { id: 'e-2', creator_id: 'creator-8', challenge_id: 'ch-1', status: 'approved' },
      ],
      creator_challenges: [{ id: 'ch-1', status: 'voting', voting_type: 'token', token_vote_cost: 5 }],
    })
    mocks.createServiceClient.mockReturnValue(db)
    mocks.createClient.mockReturnValue({ auth: { getUser: async () => ({ data: { user: { id: USER } } }) }, from: db.from })
  })

  it('two concurrent votes for the same entry produce ONE vote and ONE debit', async () => {
    const [a, b] = await Promise.all([vote(), vote()])

    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    const bodies = [await a.json(), await b.json()]
    expect(bodies.filter(x => x.duplicate)).toHaveLength(1)
    expect(db.rows('challenge_votes')).toHaveLength(1)
    expect(db.rows('token_ledger').filter(l => l.type === 'challenge_vote')).toHaveLength(1)
    expect(db.tokens(USER)).toBe(95)
  })

  it('a retry after success is a no-charge duplicate, not a 500', async () => {
    expect((await vote()).status).toBe(200)
    const again = await vote()
    expect(again.status).toBe(200)
    expect((await again.json()).tokens_spent).toBe(0)
    expect(db.tokens(USER)).toBe(95)
  })

  it('different entries are separate votes and separate charges', async () => {
    await vote('e-1')
    await vote('e-2')
    expect(db.rows('challenge_votes')).toHaveLength(2)
    expect(db.tokens(USER)).toBe(90)
  })

  it('insufficient tokens: 402, no vote row, no debit', async () => {
    db.rows('hapi_tokens')[0].balance = 2
    const res = await vote()
    expect(res.status).toBe(402)
    expect((await res.json()).balance).toBe(2)
    expect(db.rows('challenge_votes')).toHaveLength(0)
    expect(db.tokens(USER)).toBe(2)
  })

  it('a failure inside the RPC leaves no vote and no debit (500)', async () => {
    db.faultRpc('cast_paid_vote', 'before')
    const res = await vote()
    expect(res.status).toBe(500)
    expect(db.rows('challenge_votes')).toHaveLength(0)
    expect(db.tokens(USER)).toBe(100)
  })

  it('a free vote twice is a duplicate, not a 500', async () => {
    db.rows('creator_challenges')[0].voting_type = 'free'
    expect((await vote('e-1', 0)).status).toBe(200)
    const again = await vote('e-1', 0)
    expect(again.status).toBe(200)
    expect((await again.json()).duplicate).toBe(true)
    expect(db.rows('challenge_votes')).toHaveLength(1)
    expect(db.tokens(USER)).toBe(100)
  })
})
