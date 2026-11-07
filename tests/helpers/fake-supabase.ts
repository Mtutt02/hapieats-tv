import { vi } from 'vitest'

export type QueryResult = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number | null }

const CHAIN_METHODS = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'gte', 'order', 'limit'] as const

/** A chainable, awaitable stand-in for a PostgREST query that resolves to `result`. */
export function queryChain(result: QueryResult = {}) {
  const resolved = { data: null, error: null, count: null, ...result }
  const chain: Record<string, unknown> = {}
  for (const m of CHAIN_METHODS) chain[m] = vi.fn(() => chain)
  chain.single = vi.fn(async () => resolved)
  chain.maybeSingle = vi.fn(async () => resolved)
  chain.then = (onOk: (v: typeof resolved) => unknown, onErr: (e: unknown) => unknown) =>
    Promise.resolve(resolved).then(onOk, onErr)
  return chain as Record<(typeof CHAIN_METHODS)[number], ReturnType<typeof vi.fn>> & {
    single: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
  }
}

/**
 * Fake Supabase client. `tables[name]` is a queue of chains: each `from(name)` call
 * consumes the next one, so a test states exactly which queries a route may run.
 * An unexpected extra query throws, which fails the test (proves nothing else was written).
 */
export function fakeService(tables: Record<string, ReturnType<typeof queryChain>[]>) {
  const queues = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, [...v]]))
  const from = vi.fn((table: string) => {
    const next = queues[table]?.shift()
    if (!next) throw new Error(`Unexpected query on table "${table}"`)
    return next
  })
  return { from }
}

/** Fake session client returned by createClient(): only auth.getUser and (optionally) profiles. */
export function fakeSession(userId: string | null, profiles: ReturnType<typeof queryChain>[] = []) {
  const queue = [...profiles]
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null } })) },
    from: vi.fn(() => {
      const next = queue.shift()
      if (!next) throw new Error('Unexpected session query')
      return next
    }),
  }
}
