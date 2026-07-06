import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { autoRepayLoanFromCashout } from '@/lib/credits'

// 1 Flavor Point = $0.0099 (base rate: 100 pts = $0.99)
const USD_PER_POINT = 0.0099
// Platform cashout fee: 5%
const CASHOUT_FEE_PCT = 0.05
// Minimum cashout: 1,000 points (~$9.90 gross / ~$9.40 net)
const MIN_POINTS = 1000

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Sum all pending earnings
  const { data: earnings } = await supabase
    .from('creator_flavor_earnings')
    .select('points_earned')
    .eq('creator_id', user.id)
    .eq('status', 'pending')

  const pendingPoints = (earnings ?? []).reduce((sum, r) => sum + r.points_earned, 0)
  const usdGross = parseFloat((pendingPoints * USD_PER_POINT).toFixed(2))
  const platformFeeUsd = parseFloat((usdGross * CASHOUT_FEE_PCT).toFixed(2))
  const usdNet = parseFloat((usdGross - platformFeeUsd).toFixed(2))

  // Past cashout requests
  const { data: history } = await supabase
    .from('flavor_cashout_requests')
    .select('id, points_total, usd_gross, platform_fee_usd, usd_net, status, created_at, processed_at')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    pendingPoints,
    usdGross,
    platformFeePct: CASHOUT_FEE_PCT,
    platformFeeUsd,
    usdNet,
    minPoints: MIN_POINTS,
    canCashout: pendingPoints >= MIN_POINTS,
    history: history ?? [],
  })
}

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Must be a creator to cash out
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_creator')
    .eq('id', user.id)
    .single()
  if (!profile?.is_creator) {
    return NextResponse.json({ error: 'Creator account required to cash out' }, { status: 403 })
  }

  const serviceClient = createServiceClient()

  // Prevent duplicate pending cashout requests
  const { data: existingRequest } = await serviceClient
    .from('flavor_cashout_requests')
    .select('id')
    .eq('creator_id', user.id)
    .eq('status', 'pending')
    .single()
  if (existingRequest) {
    return NextResponse.json({ error: 'You already have a pending cashout request' }, { status: 409 })
  }

  // Fetch all pending earnings
  const { data: earnings } = await serviceClient
    .from('creator_flavor_earnings')
    .select('id, points_earned')
    .eq('creator_id', user.id)
    .eq('status', 'pending')

  if (!earnings || earnings.length === 0) {
    return NextResponse.json({ error: 'No pending earnings to cash out' }, { status: 400 })
  }

  const pendingPoints = earnings.reduce((sum, r) => sum + r.points_earned, 0)
  if (pendingPoints < MIN_POINTS) {
    return NextResponse.json({
      error: `Minimum cashout is ${MIN_POINTS.toLocaleString()} points (~$${(MIN_POINTS * USD_PER_POINT).toFixed(2)})`,
    }, { status: 400 })
  }

  const usdGross = parseFloat((pendingPoints * USD_PER_POINT).toFixed(2))
  const platformFeeUsd = parseFloat((usdGross * CASHOUT_FEE_PCT).toFixed(2))
  const usdNet = parseFloat((usdGross - platformFeeUsd).toFixed(2))

  // Create cashout request
  const { data: cashoutReq, error: cashoutErr } = await serviceClient
    .from('flavor_cashout_requests')
    .insert({
      creator_id: user.id,
      points_total: pendingPoints,
      usd_gross: usdGross,
      platform_fee_pct: CASHOUT_FEE_PCT,
      platform_fee_usd: platformFeeUsd,
      usd_net: usdNet,
      status: 'pending',
    })
    .select('id')
    .single()

  if (cashoutErr || !cashoutReq) {
    return NextResponse.json({ error: 'Failed to create cashout request' }, { status: 500 })
  }

  // Mark earnings as cashed out
  const earnigIds = earnings.map(e => e.id)
  await serviceClient
    .from('creator_flavor_earnings')
    .update({ status: 'cashed_out', cashout_id: cashoutReq.id })
    .in('id', earnigIds)

  // Auto-repay outstanding credit loans from this cashout
  let loanDeducted = 0
  try {
    loanDeducted = await autoRepayLoanFromCashout({
      userId: user.id,
      cashoutId: cashoutReq.id,
      cashoutUsdNet: usdNet,
    })
  } catch (loanErr) {
    // Non-fatal — log but don't fail the cashout
    console.error('[cashout] loan auto-repay error:', loanErr)
  }

  const netAfterLoan = parseFloat((usdNet - loanDeducted).toFixed(2))

  return NextResponse.json({
    success: true,
    cashoutId: cashoutReq.id,
    pointsTotal: pendingPoints,
    usdGross,
    platformFeeUsd,
    usdNet,
    loanDeducted,
    netAfterLoan,
    message: loanDeducted > 0
      ? `Cashout submitted for $${usdNet.toFixed(2)}. $${loanDeducted.toFixed(2)} auto-applied to your credit loan. You will receive $${netAfterLoan.toFixed(2)} within 5–7 business days.`
      : `Cashout request submitted for $${usdNet.toFixed(2)}. Platform fee: $${platformFeeUsd.toFixed(2)} (5%). You will receive payment within 5–7 business days.`,
  })
}
