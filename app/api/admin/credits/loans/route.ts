import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/credits/loans
 * Returns all users with a non-zero loan_balance, with user info.
 * Admin + superadmin only.
 */
export async function GET() {
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

  const { data: loans, error } = await serviceClient
    .from('app_credits')
    .select(`
      user_id, gift_balance, loan_balance, loan_repaid,
      user:profiles!app_credits_user_id_fkey(id, username, display_name)
    `)
    .gt('loan_balance', 0)
    .order('loan_balance', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ loans: loans ?? [] })
}
