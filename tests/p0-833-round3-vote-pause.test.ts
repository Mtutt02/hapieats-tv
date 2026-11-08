import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MoneyDb } from './helpers/fake-money-db'

// #833 round 3, finding 12: token-spending challenge votes follow PAYMENTS_PAUSED like goal contributions.

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createServiceClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient, createServiceClient: mocks.createServiceClient }))

import { POST } from '@/app/api/challenges/[id]/vote/route'

const MESSAGE = 'Purchases are paused for a short maintenance. Free videos still play.'
let db: MoneyDb

const vote = () =>
  POST(
    new NextRequest('http://localhost/api/challenges/ch-1/vote', { method: 'POST', body: JSON.stringify({ entry_id: 'e-1', tokens_to_spend: 5 }) }),
    { params: { id: 'ch-1' } },
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  db = new MoneyDb({
    hapi_tokens: [{ user_id: 'u1', balance: 100 }],
    challenge_entries: [{ id: 'e-1', creator_id: 'creator-9', challenge_id: 'ch-1', status: 'approved' }],
    creator_challenges: [{ id: 'ch-1', status: 'voting', voting_type: 'token', token_vote_cost: 5 }],
  })
  mocks.createServiceClient.mockReturnValue(db)
  mocks.createClient.mockReturnValue({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, from: db.from })
})

afterEach(() => { delete process.env.PAYMENTS_PAUSED })

describe('challenge vote (finding 12)', () => {
  it('while paused, a token vote returns the friendly 503 and spends nothing', async () => {
    process.env.PAYMENTS_PAUSED = '1'

    const res = await vote()

    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe(MESSAGE)
    expect(db.tokens('u1')).toBe(100)
    expect(db.rows('token_ledger')).toHaveLength(0)
    expect(db.rows('challenge_votes')).toHaveLength(0)
  })

  it('while paused, a FREE vote still works', async () => {
    process.env.PAYMENTS_PAUSED = '1'
    db.rows('creator_challenges')[0].voting_type = 'free'

    const res = await vote()

    expect(res.status).not.toBe(503)
    expect(db.tokens('u1')).toBe(100)
    expect(db.rows('challenge_votes')).toHaveLength(1)
  })

  it('when not paused, the token vote spends the tokens as before', async () => {
    const res = await vote()

    expect(res.status).toBe(200)
    expect(db.tokens('u1')).toBe(95)
  })
})
