import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function tableUnavailable(): NextResponse {
  return NextResponse.json(
    { error: 'Follows are unavailable — creator_follows migration not applied yet' },
    { status: 503 }
  )
}

/** True when the error means the creator_follows table doesn't exist yet. */
function isMissingTable(code: string | undefined): boolean {
  return code === '42P01' || code === 'PGRST205'
}

// GET /api/users/follow — { following: string[] } of creator ids for the caller
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('creator_follows')
    .select('creator_id')
    .eq('follower_id', user.id)

  if (error) {
    if (isMissingTable(error.code)) return tableUnavailable()
    return NextResponse.json({ error: 'Failed to load follows' }, { status: 500 })
  }

  const following: string[] = (data ?? []).map((row: { creator_id: string }) => row.creator_id)
  return NextResponse.json({ following })
}

// POST /api/users/follow { creatorId } — follow a creator (own row via RLS)
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rate = checkRateLimit(`${user.id}:follow`, 30, 60_000)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const creatorId = body?.creatorId
  if (typeof creatorId !== 'string' || !UUID_RE.test(creatorId)) {
    return NextResponse.json({ error: 'creatorId is required' }, { status: 400 })
  }
  if (creatorId === user.id) {
    return NextResponse.json({ error: 'You cannot follow yourself' }, { status: 400 })
  }

  // User-scoped client — RLS enforces follower_id = auth.uid()
  const { error } = await supabase
    .from('creator_follows')
    .upsert(
      { follower_id: user.id, creator_id: creatorId },
      { onConflict: 'follower_id,creator_id', ignoreDuplicates: true }
    )

  if (error) {
    if (isMissingTable(error.code)) return tableUnavailable()
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }
    if (error.code === '23505') {
      // Already following — treat as success
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Failed to follow creator' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/users/follow?creatorId= — unfollow (deletes own row only)
export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creatorId = req.nextUrl.searchParams.get('creatorId')
  if (!creatorId || !UUID_RE.test(creatorId)) {
    return NextResponse.json({ error: 'creatorId is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('creator_follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('creator_id', creatorId)

  if (error) {
    if (isMissingTable(error.code)) return tableUnavailable()
    return NextResponse.json({ error: 'Failed to unfollow creator' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
