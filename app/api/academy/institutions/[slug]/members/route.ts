import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ROLES = new Set(['admin', 'instructor', 'student'])

async function loadInstitution(supabase: ReturnType<typeof createClient>, slug: string) {
  const { data } = await supabase
    .from('institutions')
    .select('id, owner_id')
    .eq('slug', slug)
    .single()
  return data
}

// Owner OR an admin member may manage the roster.
async function canManage(
  supabase: ReturnType<typeof createClient>,
  inst: { id: string; owner_id: string },
  userId: string,
): Promise<boolean> {
  if (inst.owner_id === userId) return true
  const { data } = await supabase
    .from('institution_members')
    .select('role')
    .eq('institution_id', inst.id)
    .eq('user_id', userId)
    .maybeSingle()
  return data?.role === 'admin'
}

// GET — roster (any member/owner can view)
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const inst = await loadInstitution(supabase, params.slug)
    if (!inst) return NextResponse.json({ error: 'Institution not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('institution_members')
      .select('user_id, role, created_at, profile:profiles(id, username, avatar_url)')
      .eq('institution_id', inst.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[academy/institutions/members] GET error:', error)
      return NextResponse.json({ error: 'Failed to load roster' }, { status: 500 })
    }
    return NextResponse.json({ members: data ?? [] })
  } catch (err) {
    console.error('[academy/institutions/members] GET error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST — add/invite a member with a role (owner/admin only)
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const inst = await loadInstitution(supabase, params.slug)
    if (!inst) return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
    if (!(await canManage(supabase, inst, user.id))) {
      return NextResponse.json({ error: 'Only owners and admins can add members' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({})) as {
      userId?: string
      username?: string
      role?: string
    }
    const role = ROLES.has(body.role ?? '') ? body.role! : 'student'

    // Resolve the target user by id or username.
    let targetId = typeof body.userId === 'string' ? body.userId.trim() : ''
    if (!targetId && typeof body.username === 'string' && body.username.trim()) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', body.username.trim())
        .maybeSingle()
      if (!prof) return NextResponse.json({ error: 'No user with that username' }, { status: 404 })
      targetId = prof.id
    }
    if (!targetId) return NextResponse.json({ error: 'Provide a userId or username' }, { status: 400 })

    // institution_members has SELECT-only RLS, so the roster write must go
    // through the service client. The owner/admin manage-check above is the gate.
    const service = createServiceClient()
    const { data: member, error } = await service
      .from('institution_members')
      .upsert(
        { institution_id: inst.id, user_id: targetId, role },
        { onConflict: 'institution_id,user_id' },
      )
      .select('user_id, role, created_at')
      .single()

    if (error) {
      console.error('[academy/institutions/members] POST error:', error)
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
    }
    return NextResponse.json({ member })
  } catch (err) {
    console.error('[academy/institutions/members] POST error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
