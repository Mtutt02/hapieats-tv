import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MoneyDb } from './helpers/fake-money-db'

// #833 fix 6: PAYMENTS_PAUSED / CREATOR_PAYOUTS_PAUSED are enforced on the server, return a
// friendly 503, leave free paths alone, and never affect webhooks.

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  sessionsCreate: vi.fn(),
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
    customers: { create: vi.fn(async () => ({ id: 'cus_x' })), retrieve: vi.fn() },
    subscriptions: { retrieve: vi.fn() },
  },
}))

const MESSAGE = 'Purchases are paused for a short maintenance. Free videos still play.'
const req = (url = '/x', body: unknown = {}) =>
  new NextRequest(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body) })
const params = { params: { classId: 'c1', id: 'g1' } }

// [label, module path, call]
type Route = [string, string, (post: (...a: any[]) => Promise<Response>) => Promise<Response>]
const CHARGE_ROUTES: Route[] = [
  ['stripe/checkout', '@/app/api/stripe/checkout/route', p => p(req())],
  ['credits/checkout', '@/app/api/credits/checkout/route', p => p(req())],
  ['credits/repay', '@/app/api/credits/repay/route', p => p(req())],
  ['tokens/purchase', '@/app/api/tokens/purchase/route', p => p(req())],
  ['flavor/purchase', '@/app/api/flavor/purchase/route', p => p(req())],
  ['classes/enroll/checkout', '@/app/api/classes/[classId]/enroll/checkout/route', p => p(req(), params)],
  ['academy/pro/subscribe', '@/app/api/academy/pro/subscribe/route', p => p(req())],
  ['live/gift', '@/app/api/live/gift/route', p => p(req())],
  ['flavor/gift', '@/app/api/flavor/gift/route', p => p(req())],
  ['goals/contribute', '@/app/api/goals/[id]/contribute/route', p => p(req(), params)],
]
const PAYOUT_ROUTES: Route[] = [
  ['academy/payout/run', '@/app/api/academy/payout/run/route', p => p(req())],
  ['flavor/cashout', '@/app/api/flavor/cashout/route', p => p()],
  ['creator/wallet (withdraw)', '@/app/api/creator/wallet/route', p => p(req())],
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  // Any route that gets past the pause check would need a database or Stripe: make that loud.
  mocks.createClient.mockImplementation(() => { throw new Error('route reached the database while paused') })
  mocks.createServiceClient.mockImplementation(() => { throw new Error('route reached the database while paused') })
  mocks.sessionsCreate.mockImplementation(() => { throw new Error('route reached Stripe while paused') })
  process.env.STRIPE_SECRET_KEY = 'sk_test_' + 'x'.repeat(30)
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_not_a_real_secret'
  process.env.CRON_SECRET = 'cron_test_secret'
})

afterEach(() => {
  delete process.env.PAYMENTS_PAUSED
  delete process.env.CREATOR_PAYOUTS_PAUSED
})

describe('PAYMENTS_PAUSED=1', () => {
  beforeEach(() => { process.env.PAYMENTS_PAUSED = '1' })

  it.each(CHARGE_ROUTES)('%s returns 503 with the friendly message and touches nothing', async (_label, path, call) => {
    const mod = await import(/* @vite-ignore */ path)

    const res = await call(mod.POST)

    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: MESSAGE, paused: 'payments' })
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.createServiceClient).not.toHaveBeenCalled()
    expect(mocks.sessionsCreate).not.toHaveBeenCalled()
  })

  it('payout routes are NOT blocked by the payments flag alone', async () => {
    const mod = await import('@/app/api/academy/payout/run/route')

    // gets past the pause check and (correctly) hits auth / the database
    await expect(mod.POST(req())).rejects.toThrow('route reached the database')
  })

  it('a PAID course enrollment is blocked, but a FREE one still works', async () => {
    const { POST } = await import('@/app/api/courses/enroll/route')
    const db = new MoneyDb({
      courses: [
        { id: 'paid-1', title: 'Paid', pricing_model: 'paid', price: 20, creator_id: 'other', status: 'published', enrollment_count: 0 },
        { id: 'free-1', title: 'Free', pricing_model: 'free', price: 0, creator_id: 'other', status: 'published', enrollment_count: 0 },
      ],
    })
    mocks.createClient.mockImplementation(() => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, from: db.from }))

    const paid = await POST(req('/api/courses/enroll', { courseId: 'paid-1' }))
    const free = await POST(req('/api/courses/enroll', { courseId: 'free-1' }))

    expect(paid.status).toBe(503)
    expect((await paid.json()).error).toBe(MESSAGE)
    expect(mocks.sessionsCreate).not.toHaveBeenCalled()
    expect(free.status).toBe(200)
    expect(await free.json()).toMatchObject({ enrolled: true })
  })

  it('webhooks still process, so in-flight payments complete', async () => {
    const { POST } = await import('@/app/api/stripe/webhook/route')
    const db = new MoneyDb()
    mocks.createServiceClient.mockReturnValue(db)

    const res = await POST(req('/api/stripe/webhook', {
      id: 'evt_pause', type: 'checkout.session.completed',
      data: { object: { id: 'cs_p', metadata: { userId: 'u1', checkoutMode: 'token_purchase', tokenAmount: '500' } } },
    }))

    expect(res.status).toBe(200)
    expect(db.tokens('u1')).toBe(500)
  })

  it('the RevenueCat webhook still processes', async () => {
    process.env.REVENUECAT_WEBHOOK_SECRET = 'rc_secret_value'
    const { POST } = await import('@/app/api/iap/revenuecat-webhook/route')
    const db = new MoneyDb()
    mocks.createServiceClient.mockReturnValue(db)
    const user = '22222222-2222-4222-8222-222222222222'

    const res = await POST(new NextRequest('http://localhost/x', {
      method: 'POST',
      headers: { authorization: 'Bearer rc_secret_value' },
      body: JSON.stringify({ event: { id: 'rc1', type: 'NON_RENEWING_PURCHASE', app_user_id: user, product_id: 'hapi_tokens_100' } }),
    }))

    expect(res.status).toBe(200)
    expect(db.tokens(user)).toBe(100)
  })
})

describe('CREATOR_PAYOUTS_PAUSED=1', () => {
  beforeEach(() => { process.env.CREATOR_PAYOUTS_PAUSED = '1' })

  it.each(PAYOUT_ROUTES)('%s returns 503 and touches nothing', async (_label, path, call) => {
    const mod = await import(/* @vite-ignore */ path)

    const res = await call(mod.POST)

    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ paused: 'payouts' })
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.createServiceClient).not.toHaveBeenCalled()
  })

  it('does not block purchases', async () => {
    const mod = await import('@/app/api/tokens/purchase/route')

    // gets past the pause check (and then trips over the loud database mock)
    await expect(mod.POST(req('/x', { packId: 'p' }))).rejects.toThrow()
  })

  it('the cron payout run is blocked even with a valid cron secret', async () => {
    const { POST } = await import('@/app/api/academy/payout/run/route')
    const r = new NextRequest('http://localhost/x', { method: 'POST', headers: { 'x-cron-secret': 'cron_test_secret' }, body: '{}' })

    expect((await POST(r)).status).toBe(503)
  })

  it('the payout pause also holds for the string "true"', async () => {
    process.env.CREATOR_PAYOUTS_PAUSED = 'true'
    const { POST } = await import('@/app/api/flavor/cashout/route')

    expect((await POST()).status).toBe(503)
  })
})

describe('flags unset = normal', () => {
  it('the status endpoint reports nothing paused and a pause when set', async () => {
    const { GET } = await import('@/app/api/payments/status/route')

    expect(await (await GET()).json()).toMatchObject({ paymentsPaused: false, payoutsPaused: false })

    process.env.PAYMENTS_PAUSED = '1'
    expect(await (await GET()).json()).toMatchObject({ paymentsPaused: true, payoutsPaused: false })
  })

  it('a charge route proceeds past the pause check', async () => {
    const mod = await import('@/app/api/live/gift/route')

    await expect(mod.POST(req())).rejects.toThrow('route reached the database') // i.e. it was not short-circuited
  })
})
