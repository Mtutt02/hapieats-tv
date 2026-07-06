import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/credits/request
 * Authenticated users submit a credit application.
 * Body: { type: 'gift'|'loan', amount: number, reason: string }
 *
 * Rules:
 * - Max $500 per request
 * - Only one pending request at a time
 * - Reason must be at least 20 chars
 */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { type, amount, reason } = body

  if (!['gift', 'loan'].includes(type)) {
    return NextResponse.json({ error: 'type must be "gift" or "loan"' }, { status: 400 })
  }

  const numAmount = parseFloat(amount)
  if (isNaN(numAmount) || numAmount <= 0 || numAmount > 500) {
    return NextResponse.json({ error: 'Amount must be between $0.01 and $500.00' }, { status: 400 })
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 20) {
    return NextResponse.json({ error: 'Please explain your reason (at least 20 characters)' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Enforce one-pending-at-a-time
  const { data: existing } = await serviceClient
    .from('credit_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .single()

  if (existing) {
    return NextResponse.json({
      error: 'You already have a pending request. Wait for a decision before submitting another.',
    }, { status: 409 })
  }

  const { data, error } = await serviceClient
    .from('credit_requests')
    .insert({ user_id: user.id, type, amount: numAmount, reason: reason.trim() })
    .select('id, type, amount, reason, status, created_at')
    .single()

  if (error || !data) {
    console.error('[credits/request] insert error:', error)
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
  }

  return NextResponse.json({ success: true, request: data })
}

/**
 * GET /api/credits/request
 * Returns the authenticated user's own credit request history.
 */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requests, error } = await supabase
    .from('credit_requests')
    .select('id, type, amount, reason, status, review_notes, reviewed_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ requests: requests ?? [] })
}
