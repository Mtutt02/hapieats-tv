import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'superadmin', 'moderator'].includes(profile.role ?? '')) return null
  return { user, profile }
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { userId, action, reason } = body
  if (!userId || !action) return NextResponse.json({ error: 'userId and action required' }, { status: 400 })

  const service = createServiceClient()

  // Prevent acting on superadmin accounts (except toggle_creator — superadmin can grant themselves creator)
  const { data: target } = await service.from('profiles').select('role, is_creator').eq('id', userId).single()
  if (target?.role === 'superadmin' && action !== 'toggle_creator') {
    return NextResponse.json({ error: 'Cannot modify superadmin account' }, { status: 403 })
  }

  // Moderators can only suspend/unsuspend — not change roles
  if (['promote', 'demote'].includes(action) && !['admin', 'superadmin'].includes(admin.profile.role ?? '')) {
    return NextResponse.json({ error: 'Only admins can change user roles' }, { status: 403 })
  }

  switch (action) {
    case 'suspend': {
      const { error } = await service.from('profiles').update({
        suspended_at: new Date().toISOString(),
        suspension_reason: reason ?? 'Suspended by admin',
      }).eq('id', userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    case 'unsuspend': {
      const { error } = await service.from('profiles').update({
        suspended_at: null,
        suspension_reason: null,
      }).eq('id', userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    case 'promote': {
      // Only superadmin can promote to admin
      if (admin.profile.role !== 'superadmin') {
        return NextResponse.json({ error: 'Only superadmin can promote users' }, { status: 403 })
      }
      const { data: updated, error } = await service.from('profiles').update({ role: 'admin' }).eq('id', userId).select('id, role')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!updated || updated.length === 0) return NextResponse.json({ error: 'No rows updated — user not found' }, { status: 404 })
      return NextResponse.json({ success: true, updated })
    }

    case 'demote': {
      if (admin.profile.role !== 'superadmin') {
        return NextResponse.json({ error: 'Only superadmin can change roles' }, { status: 403 })
      }
      const { data: updated, error } = await service.from('profiles').update({ role: 'user' }).eq('id', userId).select('id, role')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!updated || updated.length === 0) return NextResponse.json({ error: 'No rows updated — user not found' }, { status: 404 })
      return NextResponse.json({ success: true, updated })
    }

    case 'set_password': {
      // Password resets are admin/superadmin only — not moderators (takeover risk).
      // (Superadmin targets are already blocked by the guard above.)
      if (!['admin', 'superadmin'].includes(admin.profile.role ?? '')) {
        return NextResponse.json({ error: 'Only admins can reset passwords' }, { status: 403 })
      }
      const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
      }
      const { error } = await service.auth.admin.updateUserById(userId, { password: newPassword })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    case 'toggle_creator': {
      // Only superadmin can toggle creator status
      if (admin.profile.role !== 'superadmin') {
        return NextResponse.json({ error: 'Only superadmin can toggle creator status' }, { status: 403 })
      }
      const { error } = await service
        .from('profiles')
        .update({ is_creator: !target?.is_creator })
        .eq('id', userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, isCreator: !target?.is_creator })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
