/**
 * POST /api/academy/payout/run
 *
 * Snapshots a month's HapiEats Pro revenue and distributes the creator pool.
 * Cron- or admin-only.
 *
 * Auth gate (either passes):
 *   - header x-cron-secret === process.env.CRON_SECRET, OR
 *   - a signed-in profile whose role is 'admin' | 'superadmin'.
 *
 * Month: body.month ('YYYY-MM') or, by default, last calendar month.
 *
 * Economics (all integer cents):
 *   gross_cents = sum over that month's pro_revenue_ledger rows of
 *     (amount collected - amount refunded). The ledger is written by the Stripe
 *     webhook from real paid Pro invoices (invoice.paid / charge.refunded), so
 *     the pool is never an estimate from subscriber count x list price.
 *   pool_cents = round(gross_cents * PRO_POOL_PCT)
 *   Each creator's share = floor(pool_cents * creatorCredits / totalCredits),
 *     where credits come from academy_engagement rows with month=month AND
 *     via_pro=true, scored by engagementCredits(minutes, completed).
 *
 * Atomicity / idempotency: the credit of every creator wallet, the earnings rows
 * and the pool's distributed flag are written by ONE SQL function
 * (run_pro_payout), in one transaction, under a row lock on the pool. A failure
 * commits nothing; a re-run, or a concurrent run, of a distributed month is a
 * no-op. Months that are not finished yet are refused.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PRO_POOL_PCT, engagementCredits } from '@/lib/academy/types'
import { payoutsPausedResponse } from '@/lib/payments-pause'

export const dynamic = 'force-dynamic'

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7) // 'YYYY-MM' (UTC)
}

function lastMonth(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return d.toISOString().slice(0, 7) // 'YYYY-MM'
}

export async function POST(req: NextRequest) {
  const paused = payoutsPausedResponse()
  if (paused) return paused
  const service = createServiceClient()

  // ── Auth gate: cron secret OR admin/superadmin session ──────────────────────
  const cronSecret = process.env.CRON_SECRET
  const providedSecret = req.headers.get('x-cron-secret')
  const cronOk = !!cronSecret && providedSecret === cronSecret

  if (!cronOk) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!['admin', 'superadmin'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await req.json().catch(() => ({}))
  const month: string = typeof body?.month === 'string' && /^\d{4}-\d{2}$/.test(body.month)
    ? body.month
    : lastMonth()

  // The ledger for a month is only complete once the month is over.
  if (month >= currentMonth()) {
    return NextResponse.json({ error: 'That month is not finished yet', month }, { status: 400 })
  }

  // ── Idempotency: never distribute a month twice ─────────────────────────────
  const { data: existingPool } = await service
    .from('pro_payout_pool')
    .select('month, distributed')
    .eq('month', month)
    .maybeSingle()

  if (existingPool?.distributed) {
    return NextResponse.json({ skipped: true, reason: 'already distributed', month })
  }

  // ── Gross: Pro invoices Stripe actually collected that month, net of refunds ─
  const { data: revenue, error: revErr } = await service
    .from('pro_revenue_ledger')
    .select('amount_cents, refunded_cents')
    .eq('month', month)
  if (revErr) {
    console.error('[academy/payout] revenue ledger query error:', revErr)
    return NextResponse.json({ error: 'Revenue query failed' }, { status: 500 })
  }
  const invoicesCounted = (revenue ?? []).length
  const grossCents = (revenue ?? []).reduce(
    (sum, r) => sum + Math.max(Number(r.amount_cents) - Number(r.refunded_cents ?? 0), 0),
    0,
  )
  const poolCents = Math.round(grossCents * PRO_POOL_PCT)

  // ── Credits: sum engagement credits by creator for Pro-sourced watching ─────
  const { data: engagement, error: engErr } = await service
    .from('academy_engagement')
    .select('creator_id, minutes, completed')
    .eq('month', month)
    .eq('via_pro', true)

  if (engErr) {
    console.error('[academy/payout] engagement query error:', engErr)
    return NextResponse.json({ error: 'Engagement query failed' }, { status: 500 })
  }

  const creditsByCreator = new Map<string, number>()
  let totalCredits = 0
  for (const row of engagement ?? []) {
    const c = engagementCredits(Number(row.minutes) || 0, !!row.completed)
    if (c <= 0) continue
    creditsByCreator.set(row.creator_id, (creditsByCreator.get(row.creator_id) ?? 0) + c)
    totalCredits += c
  }

  // ── Split by credit share ───────────────────────────────────────────────────
  const earnings: { creator_id: string; credits: number; cents: number }[] = []
  if (totalCredits > 0 && poolCents > 0) {
    for (const [creatorId, credits] of creditsByCreator) {
      earnings.push({ creator_id: creatorId, credits, cents: Math.floor((poolCents * credits) / totalCredits) })
    }
  }

  // ── One transaction: lock the month, credit every wallet, mark distributed ───
  // Either everything below commits or nothing does, so the pool can never be
  // flagged distributed while a wallet credit is missing, and a re-run (or a
  // concurrent run) sees distributed=true and does nothing.
  const { data: result, error: payErr } = await service.rpc('run_pro_payout', {
    p_month: month,
    p_expected_gross: grossCents,
    p_pool_cents: poolCents,
    p_total_credits: totalCredits,
    p_earnings: earnings,
  })
  if (payErr) {
    if (payErr.message?.includes('GROSS_CHANGED')) {
      return NextResponse.json({ error: 'Revenue changed while the payout was being prepared — run it again', month }, { status: 409 })
    }
    console.error('[academy/payout] run_pro_payout failed (nothing was committed):', payErr)
    return NextResponse.json({ error: 'Payout failed — nothing was paid; safe to run again' }, { status: 500 })
  }
  if (result?.status === 'already_distributed') {
    return NextResponse.json({ skipped: true, reason: 'already distributed', month })
  }

  return NextResponse.json({
    month,
    source: 'recorded_invoices',
    invoicesCounted,
    grossCents,
    poolCents,
    totalCredits,
    creatorsPaid: result?.creators_paid ?? 0,
    distributedCents: result?.distributed_cents ?? 0,
    ...(earnings.length === 0 ? { note: 'No Pro revenue or Pro-sourced engagement to distribute this month.' } : {}),
  })
}
