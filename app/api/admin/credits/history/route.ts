import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/credits/history
 * Returns all credit_grants (admin-issued) with user info.
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

  const { data: grants, error } = await serviceClient
    .from('credit_grants')
    .select(`
      id, type, amount, notes, created_at,
      user:profiles!credit_grants_user_id_fkey(id, username, display_name),
      granter:profiles!credit_grants_granted_by_fkey(username, display_name)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ grants: grants ?? [] })
}
