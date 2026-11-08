import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MoneyDb } from './helpers/fake-money-db'

// #833 fix 5: gifts debit the sender and credit the creator atomically, never go negative,
// and a double-submit is charged once.

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createServiceClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createServiceClient: mocks.createServiceClient,
}))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => ({ allowed: true }) }))

import { POST as liveGift } from '@/app/api/live/gift/route'
import { POST as flavorGift } from '@/app/api/flavor/gift/route'

const SENDER = 'sender-1'
const CREATOR = 'creator-1'
let db: MoneyDb

const seed = (balance = 100) => ({
  live_streams: [{ id: 'stream-1', creator_id: CREATOR, status: 'active', title: 'Pasta night' }],
  live_gifts: [{ id: 'gift-25', name: 'Chef Kiss', emoji: '🤌', token_cost: 25, creator_pct: 70, platform_pct: 20, circle_pct: 10, is_active: true }],
  hapi_tokens: [{ user_id: SENDER, balance }],
  flavor_wallets: [{ user_id: SENDER, balance }],
  platform_settings: [{ key: 'token_conversion_rate', value: { cents_per_token: 1 } }],
})

const send = (over: Record<string, unknown> = {}) =>
  liveGift(new NextRequest('http://localhost/api/live/gift', {
    method: 'POST',
    body: JSON.stringify({ stream_id: 'stream-1', gift_id: 'gift-25', request_id: 'req-1', ...over }),
  }))
const sendFlavor = (over: Record<string, unknown> = {}) =>
  flavorGift(new NextRequest('http://localhost/api/flavor/gift', {
    method: 'POST',
    body: JSON.stringify({ giftId: 'taco_pop', streamId: 'stream-1', requestId: 'freq-1', ...over }),
  }))

const useDb = (balance = 100) => {
  db = new MoneyDb(seed(balance))
  mocks.createServiceClient.mockReturnValue(db)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.createClient.mockReturnValue({
    auth: { getUser: async () => ({ data: { user: { id: SENDER } } }) },
  })
  useDb()
})

describe('live gifts', () => {
  it('(1) debits the sender and credits the creator, together', async () => {
    const res = await send()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({ success: true, duplicate: false, tokens_spent: 25, remaining_balance: 75 })
    expect(db.tokens(SENDER)).toBe(75)
    expect(db.creatorCents(CREATOR)).toBe(17) // 70% of 25
    expect(db.rows('live_gift_transactions')).toHaveLength(1)
  })

  it('(2) double-submit with the same request id charges once', async () => {
    const [a, b] = await Promise.all([send(), send()])

    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(db.tokens(SENDER)).toBe(75)
    expect(db.creatorCents(CREATOR)).toBe(17)
    expect(db.rows('live_gift_transactions')).toHaveLength(1)
    expect([(await a.json()).duplicate, (await b.json()).duplicate].sort()).toEqual([false, true])
  })

  it('(3) sequential replay of the same request id is also free', async () => {
    await send()
    const again = await send()

    expect((await again.json()).duplicate).toBe(true)
    expect(db.tokens(SENDER)).toBe(75)
  })

  it('(4) the sender never goes negative: concurrent distinct gifts beyond the balance are refused', async () => {
    useDb(30) // affords one 25-token gift, not two

    const results = await Promise.all([send({ request_id: 'a' }), send({ request_id: 'b' })])

    expect(results.map(r => r.status).sort()).toEqual([200, 402])
    expect(db.tokens(SENDER)).toBe(5)
    expect(db.rows('live_gift_transactions')).toHaveLength(1)
    expect(db.creatorCents(CREATOR)).toBe(17)
  })

  it('(5) insufficient balance changes nothing', async () => {
    useDb(10)

    const res = await send()

    expect(res.status).toBe(402)
    expect(db.tokens(SENDER)).toBe(10)
    expect(db.rows('live_gift_transactions')).toHaveLength(0)
    expect(db.creatorCents(CREATOR)).toBe(0)
  })

  it('(6) the commit landed but the response was lost: the retry returns the original gift, charged once', async () => {
    db.faultRpc('send_live_gift', 'after')
    // old code path, so the same scenario is exercised against it: lose the response after the debit
    db.faultRpc('record_token_movement', 'after')

    const first = await send()
    expect(first.status).toBe(500)
    const retry = await send()

    expect(retry.status).toBe(200)
    expect(db.tokens(SENDER)).toBe(75)
    expect(db.rows('live_gift_transactions')).toHaveLength(1)
  })

  it('(7) a failure inside the transaction rolls everything back (no debit without a creator credit)', async () => {
    db.rows('live_gifts')[0].id = 'other' // gift lookup fails after nothing was written

    const res = await send()

    expect(res.status).toBe(404)
    expect(db.tokens(SENDER)).toBe(100)
    expect(db.creatorCents(CREATOR)).toBe(0)
  })

  it('(8) cannot gift your own stream or an ended stream', async () => {
    db.rows('live_streams')[0].creator_id = SENDER
    expect((await send()).status).toBe(400)

    db.rows('live_streams')[0].creator_id = CREATOR
    db.rows('live_streams')[0].status = 'ended'
    expect((await send({ request_id: 'zz' })).status).toBe(400)
    expect(db.tokens(SENDER)).toBe(100)
  })
})

describe('flavor gifts', () => {
  it('(9) double-submit charges once and the balance never goes negative', async () => {
    useDb(30) // taco_pop costs 25

    const [a, b] = await Promise.all([sendFlavor(), sendFlavor()])
    const c = await sendFlavor({ requestId: 'freq-2' }) // a genuinely new gift: only 5 left

    expect([a.status, b.status]).toEqual([200, 200])
    expect(c.status).toBe(402)
    expect(db.rows('flavor_wallets')[0].balance).toBe(5)
    expect(db.rows('flavor_gift_events')).toHaveLength(1)
    expect(db.rows('creator_flavor_earnings')).toHaveLength(1)
  })
})
