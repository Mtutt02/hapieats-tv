import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { grantCredits, getCreditBalance } from '@/lib/credits'

/**
 * POST /api/admin/credits/grant
 * Issue gift or loan credits to a user.
 * Requires admin or superadmin role.
 *
 * Body: { userId, type: 'gift'|'loan', amount, notes?, expiresAt? }
 */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Require admin or superadmin
  const serviceClient = createServiceClient()
  const { data: me } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!me || !['admin', 'superadmin'].includes(me.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { userId, type, amount, notes, expiresAt } = body

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }
  if (!['gift', 'loan'].includes(type)) {
    return NextResponse.json({ error: 'type must be gift or loan' }, { status: 400 })
  }
  const numAmount = parseFloat(amount)
  if (!numAmount || numAmount <= 0 || numAmount > 10_000) {
    return NextResponse.json({ error: 'amount must be between $0.01 and $10,000' }, { status: 400 })
  }

  // Verify the target user exists
  const { data: targetProfile } = await serviceClient
    .from('profiles')
    .select('id, display_name, email')
    .eq('id', userId)
    .single()

  if (!targetProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await grantCredits({
    userId,
    grantedBy: user.id,
    type,
    amount: numAmount,
    notes: notes ?? undefined,
    expiresAt: expiresAt ?? undefined,
  })

  const balance = await getCreditBalance(userId)

  return NextResponse.json({
    success: true,
    granted: { type, amount: numAmount },
    newBalance: balance,
    user: { id: targetProfile.id, displayName: targetProfile.display_name },
  })
}

/**
 * GET /api/admin/credits/grant?userId=...
 * View credit summary and ledger for a specific user.
 * Requires admin or superadmin.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: me } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!me || !['admin', 'superadmin'].includes(me.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const balance = await getCreditBalance(userId)

  const { data: ledger } = await serviceClient
    .from('credit_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: grants } = await serviceClient
    .from('credit_grants')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ balance, ledger: ledger ?? [], grants: grants ?? [] })
}
