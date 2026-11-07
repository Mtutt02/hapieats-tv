/**
 * Stateful in-memory stand-in for the Supabase service client, for the #833 money tests.
 *
 * It models just enough of PostgREST (insert/upsert/update/delete/select + eq/in filters,
 * unique constraints) and of the SQL functions in 20261107_money_fixes_833.sql (each rpc
 * body below is synchronous, i.e. atomic, the way a single Postgres transaction is).
 *
 * Fault injection:
 *   db.failTable(table, op, error)       -> every `op` on `table` returns { error }
 *   db.faultRpc(name, 'before'|'after')  -> one-shot: error before the effect, or AFTER it
 *                                           was applied (response lost / crash after commit)
 *
 * Nothing here touches a network or a secret.
 */

type Row = Record<string, any>
type Err = { code?: string; message: string } | null
type Op = 'insert' | 'upsert' | 'update' | 'delete' | 'select'

const UNIQUES: Record<string, string[][]> = {
  stripe_events: [['id']],
  iap_events: [['event_id']],
  purchases: [['buyer_id', 'video_id']],
  money_effects: [['effect_key']],
  hapi_tokens: [['user_id']],
  flavor_wallets: [['user_id']],
  app_credits: [['user_id']],
  creator_wallets: [['creator_id']],
  pro_payout_pool: [['month']],
  pro_pool_earnings: [['creator_id', 'month']],
  pro_revenue_ledger: [['stripe_invoice_id']],
  class_enrollments: [['class_id', 'user_id']],
  course_enrollments: [['course_id', 'user_id']],
  program_enrollments: [['program_id', 'user_id']],
}

export class MoneyDb {
  tables: Record<string, Row[]> = {}
  now = Date.parse('2026-11-07T12:00:00Z')
  calls: string[] = []
  private tableFaults: { table: string; op: Op; error: NonNullable<Err> }[] = []
  private rpcFaultList: { name: string; when: 'before' | 'after'; error: NonNullable<Err> }[] = []
  private seq = 0

  constructor(seed: Record<string, Row[]> = {}) {
    for (const [t, rows] of Object.entries(seed)) this.tables[t] = rows.map(r => ({ ...r }))
  }

  rows(t: string): Row[] { return (this.tables[t] ??= []) }
  failTable(table: string, op: Op, error: NonNullable<Err> = { code: 'XX000', message: 'injected failure' }) {
    this.tableFaults.push({ table, op, error })
  }
  faultRpc(name: string, when: 'before' | 'after', error: NonNullable<Err> = { code: 'XX000', message: 'injected rpc failure' }) {
    this.rpcFaultList.push({ name, when, error })
  }
  tokens(userId: string): number { return this.rows('hapi_tokens').find(r => r.user_id === userId)?.balance ?? 0 }
  creatorCents(creatorId: string): number { return this.rows('creator_wallets').find(r => r.creator_id === creatorId)?.redeemable_cents ?? 0 }

  // ── PostgREST-ish surface ────────────────────────────────────────────────
  from = (table: string) => {
    this.calls.push(`from:${table}`)
    return new Query(this, table)
  }

  rpc = async (name: string, args: Row = {}) => {
    this.calls.push(`rpc:${name}`)
    await Promise.resolve() // let concurrent callers interleave BETWEEN rpcs, never inside one
    const faultIdx = (when: 'before' | 'after') =>
      this.rpcFaultList.findIndex(f => f.name === name && f.when === when)
    let i = faultIdx('before')
    if (i >= 0) return { data: null, error: this.rpcFaultList.splice(i, 1)[0].error }
    if (name === 'claim_stripe_event' || name === 'claim_iap_event') {
      const t = name === 'claim_stripe_event' ? 'stripe_events' : 'iap_events'
      const tf = this.tableFaults.find(f => f.table === t && (f.op === 'insert' || f.op === 'upsert'))
      if (tf) return { data: null, error: tf.error }
    }
    const fn = (this as any)[`sql_${name}`]
    if (!fn) return { data: null, error: { code: '42883', message: `function ${name} does not exist` } }
    let out: { data: any; error: Err }
    try {
      out = { data: fn.call(this, args), error: null }
    } catch (e: any) {
      out = { data: null, error: { code: e.code ?? 'P0001', message: e.message } }
    }
    i = faultIdx('after')
    if (i >= 0 && !out.error) return { data: null, error: this.rpcFaultList.splice(i, 1)[0].error }
    return out
  }

  /** Throws the way plpgsql RAISE EXCEPTION does. */
  private raise(message: string, code = 'P0001'): never {
    throw Object.assign(new Error(message), { code })
  }

  // ── Table helpers used by Query and by the sql_* functions ────────────────
  violates(table: string, row: Row): boolean {
    return (UNIQUES[table] ?? []).some(cols =>
      this.rows(table).some(r => cols.every(c => r[c] !== undefined && r[c] === row[c])))
  }
  insertRow(table: string, row: Row): Row {
    if (this.violates(table, row)) this.raise(`duplicate key value violates unique constraint on ${table}`, '23505')
    const full = { id: row.id ?? `${table}-${++this.seq}`, ...row }
    this.rows(table).push(full)
    return full
  }

  // ── SQL function emulations (mirror 20261107_money_fixes_833.sql) ─────────
  private effectOnce(key: string, kind: string): boolean {
    if (this.rows('money_effects').some(r => r.effect_key === key)) return false
    this.rows('money_effects').push({ effect_key: key, kind })
    return true
  }

  sql_claim_stripe_event(a: Row) { return this.claim('stripe_events', 'id', a.p_id, { type: a.p_type }, a.p_lease_seconds ?? 120) }
  sql_claim_iap_event(a: Row) {
    return this.claim('iap_events', 'event_id', a.p_event_id,
      { user_id: a.p_user_id, type: a.p_type, product_id: a.p_product_id }, a.p_lease_seconds ?? 120)
  }
  private claim(table: string, pk: string, id: string, extra: Row, leaseSeconds: number) {
    const row = this.rows(table).find(r => r[pk] === id)
    if (!row) {
      this.rows(table).push({ [pk]: id, ...extra, status: 'processing', lease_until: this.now + leaseSeconds * 1000, attempts: 1 })
      return 'claimed'
    }
    // rows written by the old scheme have no status column: that meant "fulfilled"
    const status = row.status ?? 'completed'
    if (status === 'processing' && (row.lease_until == null || row.lease_until <= this.now)) {
      Object.assign(row, { status: 'processing', lease_until: this.now + leaseSeconds * 1000, attempts: (row.attempts ?? 0) + 1 })
      return 'claimed'
    }
    return status === 'completed' ? 'duplicate' : 'busy'
  }
  sql_complete_stripe_event(a: Row) { this.finish('stripe_events', 'id', a.p_id) }
  sql_complete_iap_event(a: Row) { this.finish('iap_events', 'event_id', a.p_event_id) }
  sql_release_stripe_event(a: Row) { this.release('stripe_events', 'id', a.p_id) }
  sql_release_iap_event(a: Row) { this.release('iap_events', 'event_id', a.p_event_id) }
  private finish(table: string, pk: string, id: string) {
    const row = this.rows(table).find(r => r[pk] === id)
    if (row) Object.assign(row, { status: 'completed', lease_until: null })
  }
  private release(table: string, pk: string, id: string) {
    const row = this.rows(table).find(r => r[pk] === id && r.status === 'processing')
    if (row) row.lease_until = this.now
  }

  /** The pre-existing record_token_movement (security_patches): locks, refuses to go negative. */
  sql_record_token_movement(a: Row) {
    let w = this.rows('hapi_tokens').find(r => r.user_id === a.p_user_id)
    if (!w) this.rows('hapi_tokens').push((w = { user_id: a.p_user_id, balance: 0 }))
    if (a.p_amount < 0 && w.balance + a.p_amount < 0) this.raise(`INSUFFICIENT_BALANCE: required ${-a.p_amount}, available ${w.balance}`, 'P0002')
    w.balance += a.p_amount
    this.rows('token_ledger').push({ user_id: a.p_user_id, type: a.p_type, amount: a.p_amount, metadata: a.p_metadata })
    return [{ success: true, new_balance: w.balance }]
  }
  sql_credit_tokens_once(a: Row) {
    if (!this.effectOnce(a.p_key, 'tokens')) return false
    this.sql_record_token_movement(a)
    return true
  }
  sql_check_monetization_auto_unlock() { return null }

  sql_credit_flavor_once(a: Row) {
    if (!this.effectOnce(a.p_key, 'flavor')) return false
    const w = this.rows('flavor_wallets').find(r => r.user_id === a.p_user_id)
    if (w) w.balance += a.p_points
    else this.rows('flavor_wallets').push({ user_id: a.p_user_id, balance: a.p_points })
    this.rows('flavor_purchases').push({ user_id: a.p_user_id, package_id: a.p_package_id, points_credited: a.p_points, stripe_session_id: a.p_session_id })
    return true
  }

  sql_repay_loan_once(a: Row) {
    if (!this.effectOnce(a.p_key, 'loan_repay')) return 0
    const c = this.rows('app_credits').find(r => r.user_id === a.p_user_id)
    if (!c) return 0
    const actual = Math.min(a.p_amount, Number(c.loan_balance))
    if (actual <= 0) return 0
    c.loan_balance = Math.round((Number(c.loan_balance) - actual) * 100) / 100
    c.loan_repaid = Math.round((Number(c.loan_repaid) + actual) * 100) / 100
    return actual
  }

  sql_restore_credits_once(a: Row) {
    if (!this.effectOnce(a.p_key, 'credit_restore')) return false
    let c = this.rows('app_credits').find(r => r.user_id === a.p_user_id)
    if (!c) this.rows('app_credits').push((c = { user_id: a.p_user_id, gift_balance: 0, loan_balance: 0, loan_repaid: 0 }))
    c.gift_balance = Math.round((Number(c.gift_balance) + Number(a.p_gift)) * 100) / 100
    c.loan_balance = Math.round((Number(c.loan_balance) + Number(a.p_loan)) * 100) / 100
    this.rows('credit_ledger').push({ user_id: a.p_user_id, entry_type: 'restore_credit', amount: Number(a.p_gift) + Number(a.p_loan), reference_id: a.p_ref })
    return true
  }

  private walletAdd(creatorId: string, tokens: number, cents: number) {
    const w = this.rows('creator_wallets').find(r => r.creator_id === creatorId)
    if (w) { w.tokens_received += tokens; w.redeemable_cents += cents }
    else this.rows('creator_wallets').push({ creator_id: creatorId, tokens_received: tokens, redeemable_cents: cents })
  }
  sql_wallet_add(a: Row) { this.walletAdd(a.p_creator_id, a.p_tokens, a.p_cents) }

  /** All-or-nothing: on any raise the snapshot is restored, like a rolled-back transaction. */
  private atomically<T>(fn: () => T): T {
    const snap = JSON.stringify([this.tables])
    try { return fn() } catch (e) { this.tables = JSON.parse(snap)[0]; throw e }
  }

  sql_run_pro_payout(a: Row) {
    return this.atomically(() => {
      let pool = this.rows('pro_payout_pool').find(r => r.month === a.p_month)
      if (!pool) this.rows('pro_payout_pool').push((pool = { month: a.p_month, distributed: false }))
      if (pool.distributed) return { status: 'already_distributed' }
      const gross = this.rows('pro_revenue_ledger')
        .filter(r => r.month === a.p_month)
        .reduce((s, r) => s + Math.max(Number(r.amount_cents) - Number(r.refunded_cents ?? 0), 0), 0)
      if (gross !== Number(a.p_expected_gross)) this.raise('GROSS_CHANGED')
      let paid = 0, n = 0
      for (const e of a.p_earnings as Row[]) {
        const prior = this.rows('pro_pool_earnings').find(r => r.creator_id === e.creator_id && r.month === a.p_month)
        if (prior?.paid) continue
        if (prior) Object.assign(prior, { credits: e.credits, cents: e.cents, paid: true })
        else this.rows('pro_pool_earnings').push({ creator_id: e.creator_id, month: a.p_month, credits: e.credits, cents: e.cents, paid: true })
        if (e.cents > 0) { this.walletAdd(e.creator_id, 0, e.cents); paid += e.cents; n++ }
      }
      Object.assign(pool, { gross_cents: gross, pool_cents: a.p_pool_cents, total_credits: a.p_total_credits, distributed: true })
      return { status: 'distributed', creators_paid: n, distributed_cents: paid, gross_cents: gross }
    })
  }

  sql_send_live_gift(a: Row) {
    return this.atomically(() => {
      const stream = this.rows('live_streams').find(r => r.id === a.p_stream_id)
      if (!stream) this.raise('STREAM_NOT_FOUND')
      if (stream.status === 'ended') this.raise('STREAM_ENDED')
      if (stream.creator_id === a.p_sender_id) this.raise('OWN_STREAM')
      const gift = this.rows('live_gifts').find(r => r.id === a.p_gift_id && r.is_active !== false)
      if (!gift) this.raise('GIFT_UNAVAILABLE')
      const dup = this.rows('live_gift_transactions').find(r => r.sender_id === a.p_sender_id && r.request_id === a.p_request_id)
      if (dup) {
        return { status: 'duplicate', transaction_id: dup.id, total_tokens: dup.total_tokens, creator_cents: dup.creator_earned_cents,
          remaining_balance: this.tokens(a.p_sender_id), gift: { name: gift.name, emoji: gift.emoji, token_cost: gift.token_cost }, creator_id: stream.creator_id }
      }
      const total = gift.token_cost * a.p_quantity
      this.sql_record_token_movement({ p_user_id: a.p_sender_id, p_type: 'live_gift', p_amount: -total, p_metadata: {} })
      const creatorCents = Math.floor(total * (gift.creator_pct / 100))
      const platformCents = Math.floor(total * (gift.platform_pct / 100))
      const tx = this.insertRow('live_gift_transactions', {
        sender_id: a.p_sender_id, recipient_id: stream.creator_id, stream_id: a.p_stream_id, gift_id: a.p_gift_id,
        quantity: a.p_quantity, total_tokens: total, creator_earned_cents: creatorCents,
        platform_fee_cents: platformCents, circle_pool_cents: total - creatorCents - platformCents, request_id: a.p_request_id,
      })
      this.walletAdd(stream.creator_id, total, creatorCents)
      return { status: 'ok', transaction_id: tx.id, total_tokens: total, creator_cents: creatorCents,
        remaining_balance: this.tokens(a.p_sender_id), gift: { name: gift.name, emoji: gift.emoji, token_cost: gift.token_cost }, creator_id: stream.creator_id }
    })
  }

  sql_send_flavor_gift(a: Row) {
    return this.atomically(() => {
      const dup = this.rows('flavor_gift_events').find(r => r.sender_id === a.p_sender_id && r.request_id === a.p_request_id)
      const w = this.rows('flavor_wallets').find(r => r.user_id === a.p_sender_id)
      if (dup) return { status: 'duplicate', event_id: dup.id, new_balance: w?.balance ?? 0 }
      if (!w || w.balance < a.p_points_cost) this.raise('INSUFFICIENT_BALANCE', 'P0002')
      w.balance -= a.p_points_cost
      const ev = this.insertRow('flavor_gift_events', {
        stream_id: a.p_stream_id, sender_id: a.p_sender_id, creator_id: a.p_creator_id, gift_id: a.p_gift_id,
        points_spent: a.p_points_cost, creator_share: a.p_creator_share, request_id: a.p_request_id,
      })
      this.rows('creator_flavor_earnings').push({ creator_id: a.p_creator_id, gift_event_id: ev.id, points_earned: a.p_creator_share, status: 'pending' })
      return { status: 'ok', event_id: ev.id, new_balance: w.balance }
    })
  }
}

class Query implements PromiseLike<{ data: any; error: Err; count?: number | null }> {
  private op: Op = 'select'
  private payload: any
  private filters: ((r: Row) => boolean)[] = []
  private conflict: string[] | null = null
  private ignoreDup = false
  private wantRows = false
  private lim: number | null = null

  constructor(private db: MoneyDb, private table: string) {}

  select(_cols?: string, _opts?: unknown) { if (this.op === 'select') this.op = 'select'; else this.wantRows = true; return this }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this }
  upsert(p: any, o: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.op = 'upsert'; this.payload = p
    this.conflict = o.onConflict ? o.onConflict.split(',').map(s => s.trim()) : ['id']
    this.ignoreDup = !!o.ignoreDuplicates
    return this
  }
  update(p: any) { this.op = 'update'; this.payload = p; return this }
  delete() { this.op = 'delete'; return this }
  eq(c: string, v: unknown) { this.filters.push(r => r[c] === v); return this }
  in(c: string, vs: unknown[]) { this.filters.push(r => vs.includes(r[c])); return this }
  gte(c: string, v: any) { this.filters.push(r => r[c] >= v); return this }
  lt(c: string, v: any) { this.filters.push(r => r[c] < v); return this }
  order() { return this }
  limit(n: number) { this.lim = n; return this }
  async single() { const r = await this.exec(); if (r.error) return r; const one = (r.data ?? [])[0]; return one ? { data: one, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } } }
  async maybeSingle() { const r = await this.exec(); return r.error ? r : { data: (r.data ?? [])[0] ?? null, error: null } }
  then<A, B>(ok?: (v: any) => A | PromiseLike<A>, bad?: (e: unknown) => B | PromiseLike<B>) { return this.exec().then(ok, bad) }

  private async exec(): Promise<{ data: any; error: Err }> {
    await Promise.resolve()
    const fault = (this.db as any).tableFaults.find((f: any) => f.table === this.table && f.op === this.op)
    if (fault) return { data: null, error: fault.error }
    const rows = this.db.rows(this.table)
    const match = (r: Row) => this.filters.every(f => f(r))
    try {
      switch (this.op) {
        case 'select': {
          let out = rows.filter(match).map(r => ({ ...r }))
          if (this.lim != null) out = out.slice(0, this.lim)
          return { data: out, error: null }
        }
        case 'insert': {
          const list: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload]
          const inserted = list.map(r => this.db.insertRow(this.table, r))
          return { data: this.wantRows ? inserted : null, error: null }
        }
        case 'upsert': {
          const list: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload]
          const out: Row[] = []
          for (const r of list) {
            const hit = rows.find(x => this.conflict!.every(c => x[c] !== undefined && x[c] === r[c]))
            if (hit) { if (!this.ignoreDup) { Object.assign(hit, r); out.push(hit) } }
            else out.push(this.db.insertRow(this.table, r))
          }
          return { data: this.wantRows ? out : null, error: null }
        }
        case 'update': {
          const hit = rows.filter(match)
          hit.forEach(r => Object.assign(r, this.payload))
          return { data: this.wantRows ? hit : null, error: null }
        }
        case 'delete': {
          this.db.tables[this.table] = rows.filter(r => !match(r))
          return { data: null, error: null }
        }
      }
    } catch (e: any) {
      return { data: null, error: { code: e.code, message: e.message } }
    }
  }
}
