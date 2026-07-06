import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/creator/monetization — return monetization status + any pending request
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const [
    { data: wallet },
    { data: request },
    { data: tokens },
  ] = await Promise.all([
    service
      .from('creator_wallets')
      .select('monetization_status, monetization_unlocked_at, monetization_unlock_reason, monetization_request_at')
      .eq('creator_id', user.id)
      .single(),
    service
      .from('monetization_requests')
      .select('id, status, request_note, admin_note, created_at, reviewed_at')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from('hapi_tokens')
      .select('lifetime_purchased')
      .eq('user_id', user.id)
      .single(),
  ])

  const lifetimePurchased = tokens?.lifetime_purchased ?? 0
  const tokensNeeded = Math.max(0, 500 - lifetimePurchased)

  return NextResponse.json({
    monetization_status: wallet?.monetization_status ?? 'locked',
    monetization_unlocked_at: wallet?.monetization_unlocked_at ?? null,
    monetization_unlock_reason: wallet?.monetization_unlock_reason ?? null,
    pending_request: request ?? null,
    lifetime_purchased: lifetimePurchased,
    tokens_needed_for_auto_unlock: tokensNeeded,
    auto_unlock_threshold: 500,
  })
}

// POST /api/creator/monetization — submit unlock request
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { note } = await request.json()
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 1000)) {
    return NextResponse.json({ error: 'note must be 1,000 characters or fewer' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verify is creator
  const { data: profile } = await service
    .from('profiles')
    .select('is_creator')
    .eq('id', user.id)
    .single()

  if (!profile?.is_creator) {
    return NextResponse.json({ error: 'Creator account required' }, { status: 403 })
  }

  // Check if already unlocked
  const { data: wallet } = await service
    .from('creator_wallets')
    .select('monetization_status')
    .eq('creator_id', user.id)
    .single()

  if (wallet?.monetization_status === 'unlocked') {
    return NextResponse.json({ error: 'Monetization is already unlocked' }, { status: 400 })
  }

  // Check for existing pending request
  const { data: existing } = await service
    .from('monetization_requests')
    .select('id, status')
    .eq('creator_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'You already have a pending request under review' }, { status: 400 })
  }

  // Create request
  const { data: req, error } = await service
    .from('monetization_requests')
    .insert({
      creator_id: user.id,
      request_note: note?.trim() || null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('monetization request error:', error)
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
  }

  // Update wallet to reflect pending review
  await service
    .from('creator_wallets')
    .update({
      monetization_status: 'pending_review',
      monetization_request_at: new Date().toISOString(),
      monetization_request_note: note?.trim() || null,
    })
    .eq('creator_id', user.id)

  return NextResponse.json({ success: true, request: req })
}
