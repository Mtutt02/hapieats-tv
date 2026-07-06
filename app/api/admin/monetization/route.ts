import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/admin/monetization — list pending requests
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  const { data: requests } = await service
    .from('monetization_requests')
    .select(`
      id, status, request_note, admin_note, created_at, reviewed_at,
      creator:profiles!monetization_requests_creator_id_fkey(
        id, username, display_name, avatar_url, email, created_at
      ),
      wallet:creator_wallets!creator_wallets_creator_id_fkey(
        monetization_status, tokens_received, lifetime_earnings_cents, redeemable_cents
      ),
      tokens:hapi_tokens!hapi_tokens_user_id_fkey(
        lifetime_purchased, balance
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ requests: requests ?? [] })
}

// POST /api/admin/monetization — approve or deny a request
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { request_id, decision, admin_note } = await request.json()
  if (!request_id || !['approved', 'denied'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: ok, error } = await service.rpc('admin_review_monetization_request', {
    p_request_id: request_id,
    p_decision: decision,
    p_admin_id: user.id,
    p_admin_note: admin_note ?? null,
  })

  if (error || !ok) {
    console.error('admin_review_monetization_request error:', error)
    return NextResponse.json({ error: 'Review failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true, decision })
}
