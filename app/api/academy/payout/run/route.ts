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
 *   gross_cents = (# active Pro subs that month) * PRO_PRICE_USD * 100
 *     ASSUMPTION: bills one full month per currently-active/trialing sub.
 *     This is an approximation — it does not prorate mid-month starts,
 *     cancellations, or failed invoices. Treat as an estimate of net Pro
 *     revenue for the pool. A future version should read actual Stripe
 *     invoices for the period.
 *   pool_cents = round(gross_cents * PRO_POOL_PCT)
 *   Each creator's share = floor(pool_cents * creatorCredits / totalCredits),
 *     where credits come from academy_engagement rows with month=month AND
 *     via_pro=true, scored by engagementCredits(minutes, completed).
 *
 * Idempotency: if pro_payout_pool[month].distributed is already true, we skip
 * and return { skipped: true }. We only credit creator_wallets after writing
 * the pool row as distributed-in-progress, and each pro_pool_earnings row is
 * upserted on (creator_id, month) so a retry never double-credits.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PRO_PRICE_USD, PRO_POOL_PCT, engagementCredits } from '@/lib/academy/types'

export const dynamic = 'force-dynamic'

function lastMonth(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return d.toISOString().slice(0, 7) // 'YYYY-MM'
}

export async function POST(req: NextRequest) {
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

  // ── Idempotency: never distribute a month twice ─────────────────────────────
  const { data: existingPool } = await service
    .from('pro_payout_pool')
    .select('month, distributed')
    .eq('month', month)
    .single()

  if (existingPool?.distributed) {
    return NextResponse.json({ skipped: true, reason: 'already distributed', month })
  }

  // ── Gross: active Pro subs for the month (approximation, see header) ─────────
  const { count: subCount } = await service
    .from('pro_subscriptions')
    .select('id', { count: 'exact', head: true })
    .in('status', ['active', 'trialing'])

  const activeSubs = subCount ?? 0
  const grossCents = Math.round(activeSubs * PRO_PRICE_USD * 100)
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

  // ── Write the pool snapshot (distributed=true up front; idempotency guarded) ─
  const { error: poolErr } = await service
    .from('pro_payout_pool')
    .upsert(
      {
        month,
        gross_cents: grossCents,
        pool_cents: poolCents,
        total_credits: totalCredits,
        distributed: true,
        distributed_at: new Date().toISOString(),
      },
      { onConflict: 'month' },
    )
  if (poolErr) {
    console.error('[academy/payout] pool upsert error:', poolErr)
    return NextResponse.json({ error: 'Pool write failed' }, { status: 500 })
  }

  // Nothing to split — snapshot recorded, no earnings.
  if (totalCredits <= 0 || poolCents <= 0) {
    return NextResponse.json({
      month,
      activeSubs,
      grossCents,
      poolCents,
      totalCredits,
      creatorsPaid: 0,
      distributedCents: 0,
      note: 'No Pro-sourced engagement to distribute this month.',
    })
  }

  // ── Split by credit share; credit each creator's wallet ─────────────────────
  const earnings: { creator_id: string; credits: number; cents: number }[] = []
  for (const [creatorId, credits] of creditsByCreator) {
    const cents = Math.floor((poolCents * credits) / totalCredits)
    earnings.push({ creator_id: creatorId, credits, cents })
  }

  let distributedCents = 0
  let creatorsPaid = 0
  for (const e of earnings) {
    // Upsert earnings row first (idempotent on creator_id,month). If it already
    // existed as paid, skip the wallet credit to avoid double-paying on retry.
    const { data: prior } = await service
      .from('pro_pool_earnings')
      .select('paid')
      .eq('creator_id', e.creator_id)
      .eq('month', month)
      .single()

    if (prior?.paid) continue

    const { error: earnErr } = await service
      .from('pro_pool_earnings')
      .upsert(
        { creator_id: e.creator_id, month, credits: e.credits, cents: e.cents, paid: false },
        { onConflict: 'creator_id,month' },
      )
    if (earnErr) {
      console.error(`[academy/payout] earnings upsert error for ${e.creator_id}:`, earnErr)
      continue
    }

    if (e.cents > 0) {
      const { error: walletErr } = await service.rpc('wallet_add', {
        p_creator_id: e.creator_id,
        p_tokens: 0,
        p_cents: e.cents,
      })
      if (walletErr) {
        console.error(`[academy/payout] wallet_add error for ${e.creator_id}:`, walletErr)
        continue // leave earnings row paid=false so a rerun can retry the credit
      }
    }

    await service
      .from('pro_pool_earnings')
      .update({ paid: true })
      .eq('creator_id', e.creator_id)
      .eq('month', month)

    distributedCents += e.cents
    creatorsPaid += 1
  }

  return NextResponse.json({
    month,
    activeSubs,
    grossCents,
    poolCents,
    totalCredits,
    creatorsPaid,
    distributedCents,
  })
}
