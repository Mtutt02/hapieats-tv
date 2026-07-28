import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Only superadmins can create/manage moderator accounts
async function requireSuperAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'superadmin') return null
  return { user, profile }
}

// POST: create a new moderator account
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const admin = await requireSuperAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden — superadmin required' }, { status: 403 })

  const { email, password, displayName } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 })

  const service = createServiceClient()

  // Create auth user
  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName ?? 'Moderator' },
  })
  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message ?? 'Failed to create user' }, { status: 500 })
  }

  // Update their profile role to moderator
  const username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase()
  const { error: profileError } = await service.from('profiles').upsert({
    id: authUser.user.id,
    username: `mod_${username}_${Date.now().toString(36)}`,
    display_name: displayName ?? 'Moderator',
    role: 'moderator',
  }, { onConflict: 'id' })

  // Update role if profile already exists (from handle_new_user trigger)
  if (profileError) {
    await service.from('profiles').update({
      role: 'moderator',
      display_name: displayName ?? 'Moderator',
    }).eq('id', authUser.user.id)
  }

  return NextResponse.json({
    success: true,
    userId: authUser.user.id,
    email: authUser.user.email,
  })
}

// GET: list all moderators
export async function GET() {
  const supabase = createClient()
  const admin = await requireSuperAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const { data: moderators } = await service
    .from('profiles')
    .select('id, username, display_name, role, created_at, suspended_at')
    .in('role', ['moderator', 'admin', 'superadmin'])
    .order('role', { ascending: false })

  return NextResponse.json(moderators ?? [])
}

// PATCH: update moderator role (promote to admin, demote to user, etc.)
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const admin = await requireSuperAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden — superadmin required' }, { status: 403 })

  const { userId, role } = await req.json()
  if (!userId || !role) return NextResponse.json({ error: 'userId and role required' }, { status: 400 })
  if (!['user', 'creator', 'moderator', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service.from('profiles').update({ role }).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
