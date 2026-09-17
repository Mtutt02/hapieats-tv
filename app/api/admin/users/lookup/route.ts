import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users/lookup?username=<username_or_email>
 * Find a user by username (or email if it contains @).
 * Admin + superadmin + moderator.
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

  if (!me || !['admin', 'superadmin', 'moderator'].includes(me.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const query = searchParams.get('username')?.trim()
  if (!query) return NextResponse.json({ error: 'username query param is required' }, { status: 400 })

  // Search by username or email
  let data, error
  if (query.includes('@')) {
    // Case-insensitive, but still an EXACT match: `_` and `%` are LIKE
    // metacharacters and are legal in an email local-part, so escape them or
    // `a_b@x.com` silently matches `aXb@x.com` — a different person.
    const emailPattern = query.replace(/([\\%_])/g, '\\$1')
    ;({ data, error } = await serviceClient
      .from('profiles')
      .select('id, username, display_name, email, is_creator, role')
      .ilike('email', emailPattern)
      .single())
  } else {
    ;({ data, error } = await serviceClient
      .from('profiles')
      .select('id, username, display_name, email, is_creator, role')
      .ilike('username', query)
      .single())
  }

  if (error || !data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ user: data })
}
