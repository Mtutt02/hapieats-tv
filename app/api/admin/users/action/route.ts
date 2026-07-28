import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['admin', 'superadmin'].includes(me.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { userId, action, role, reason } = body

  if (!userId || !action) {
    return NextResponse.json({ error: 'Missing userId or action' }, { status: 400 })
  }

  // Prevent acting on yourself
  if (userId === user.id) {
    return NextResponse.json({ error: 'Cannot modify your own account' }, { status: 400 })
  }

  const service = createServiceClient()

  // Get the target user's role — only superadmin can touch other admins/superadmins
  const { data: target } = await service
    .from('profiles').select('role').eq('id', userId).single()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (['superadmin', 'admin'].includes(target.role ?? '') && me.role !== 'superadmin') {
    return NextResponse.json({ error: 'Only superadmin can modify admin accounts' }, { status: 403 })
  }

  switch (action) {
    case 'suspend': {
      const { error } = await service
        .from('profiles')
        .update({ suspended_at: new Date().toISOString(), suspension_reason: reason ?? 'Suspended by admin' })
        .eq('id', userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ message: 'User suspended' })
    }

    case 'unsuspend': {
      const { error } = await service
        .from('profiles')
        .update({ suspended_at: null, suspension_reason: null })
        .eq('id', userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ message: 'User reinstated' })
    }

    case 'set_role': {
      // Only superadmin can set roles
      if (me.role !== 'superadmin') {
        return NextResponse.json({ error: 'Only superadmin can change roles' }, { status: 403 })
      }
      if (!role || !['user', 'creator', 'moderator', 'admin', 'superadmin'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      const { error } = await service
        .from('profiles')
        .update({ role })
        .eq('id', userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ message: `Role updated to ${role}` })
    }

    case 'delete': {
      // Only superadmin can delete
      if (me.role !== 'superadmin') {
        return NextResponse.json({ error: 'Only superadmin can delete accounts' }, { status: 403 })
      }
      const { error } = await service.auth.admin.deleteUser(userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ message: 'User deleted' })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
