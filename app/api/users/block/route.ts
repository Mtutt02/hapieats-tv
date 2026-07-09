import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** GET /api/users/block — list of user ids the caller has blocked */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id, created_at')
    .eq('blocker_id', user.id)

  if (error) return NextResponse.json({ blocked: [] }) // table may not exist yet — degrade
  return NextResponse.json({ blocked: (data ?? []).map(r => r.blocked_id) })
}

/** POST /api/users/block  { userId } — block a user */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = await req.json().catch(() => ({}))
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }
  if (userId === user.id) {
    return NextResponse.json({ error: 'You cannot block yourself' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_blocks')
    .upsert({ blocker_id: user.id, blocked_id: userId })

  if (error) return NextResponse.json({ error: 'Blocking unavailable' }, { status: 503 })
  return NextResponse.json({ success: true })
}

/** DELETE /api/users/block?userId=... — unblock */
export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', userId)

  return NextResponse.json({ success: true })
}
