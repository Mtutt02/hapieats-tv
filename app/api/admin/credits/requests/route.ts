import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { grantCredits } from '@/lib/credits'

export const dynamic = 'force-dynamic'

/** Shared admin role check */
async function requireAdmin(supabase: ReturnType<typeof createClient>, serviceClient: ReturnType<typeof createServiceClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const, user: null }

  const { data: me } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!me || !['admin', 'superadmin'].includes(me.role ?? '')) {
    return { error: 'Forbidden', status: 403 as const, user: null }
  }

  return { error: null, status: 200 as const, user }
}

/**
 * GET /api/admin/credits/requests
 * List all credit requests. Optional ?status=pending|approved|denied
 * Also includes aggregate stats when ?stats=1
 */
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const serviceClient = createServiceClient()
  const { error, status, user } = await requireAdmin(supabase, serviceClient)
  if (error || !user) return NextResponse.json({ error }, { status })

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status')
  const wantStats = searchParams.get('stats') === '1'

  if (wantStats) {
    // Return aggregate stats for the dashboard
    const [
      { count: pending },
      { count: approved },
      { count: denied },
      { data: totalGranted },
      { data: totalLoan },
    ] = await Promise.all([
      serviceClient.from('credit_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      serviceClient.from('credit_requests').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      serviceClient.from('credit_requests').select('*', { count: 'exact', head: true }).eq('status', 'denied'),
      serviceClient.from('app_credits').select('gift_balance'),
      serviceClient.from('app_credits').select('loan_balance'),
    ])

    const totalGiftOutstanding = (totalGranted ?? []).reduce((s, r: any) => s + parseFloat(r.gift_balance ?? '0'), 0)
    const totalLoanOutstanding = (totalLoan ?? []).reduce((s: number, r: any) => s + parseFloat(r.loan_balance ?? '0'), 0)

    return NextResponse.json({
      stats: {
        pendingRequests: pending ?? 0,
        approvedRequests: approved ?? 0,
        deniedRequests: denied ?? 0,
        totalGiftOutstanding: Math.round(totalGiftOutstanding * 100) / 100,
        totalLoanOutstanding: Math.round(totalLoanOutstanding * 100) / 100,
      },
    })
  }

  // Build requests query with user info
  let query = serviceClient
    .from('credit_requests')
    .select(`
      id, type, amount, reason, status, review_notes, reviewed_at, created_at,
      user:profiles!credit_requests_user_id_fkey(id, username, display_name),
      reviewer:profiles!credit_requests_reviewed_by_fkey(username, display_name)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (statusFilter) query = (query as any).eq('status', statusFilter)

  const { data: requests, error: fetchErr } = await query
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  return NextResponse.json({ requests: requests ?? [] })
}

/**
 * PATCH /api/admin/credits/requests
 * Approve or deny a credit request.
 * Body: { requestId, action: 'approve'|'deny', reviewNotes? }
 * On approval, credits are automatically issued to the user.
 */
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const serviceClient = createServiceClient()
  const { error, status, user } = await requireAdmin(supabase, serviceClient)
  if (error || !user) return NextResponse.json({ error }, { status })

  const body = await req.json()
  const { requestId, action, reviewNotes } = body

  if (!requestId || typeof requestId !== 'string') {
    return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
  }
  if (!['approve', 'deny'].includes(action)) {
    return NextResponse.json({ error: 'action must be "approve" or "deny"' }, { status: 400 })
  }

  // Fetch the pending request
  const { data: creditReq, error: fetchErr } = await serviceClient
    .from('credit_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'pending')
    .single()

  if (fetchErr || !creditReq) {
    return NextResponse.json({ error: 'Request not found or already decided' }, { status: 404 })
  }

  const newStatus = action === 'approve' ? 'approved' : 'denied'

  // Update request
  const { error: updateErr } = await serviceClient
    .from('credit_requests')
    .update({
      status: newStatus,
      reviewed_by: user.id,
      review_notes: reviewNotes?.trim() ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Auto-grant if approved
  if (action === 'approve') {
    try {
      await grantCredits({
        userId: creditReq.user_id,
        grantedBy: user.id,
        type: creditReq.type,
        amount: parseFloat(creditReq.amount),
        notes: `Approved credit request${reviewNotes ? ` — ${reviewNotes.trim()}` : ''}`,
      })
    } catch (grantErr) {
      console.error('[admin/credits/requests] grant failed after approval:', grantErr)
      // Rollback the status change
      await serviceClient
        .from('credit_requests')
        .update({ status: 'pending', reviewed_by: null, review_notes: null, reviewed_at: null })
        .eq('id', requestId)
      return NextResponse.json({ error: 'Failed to issue credits — request status reverted' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, status: newStatus, requestId })
}
