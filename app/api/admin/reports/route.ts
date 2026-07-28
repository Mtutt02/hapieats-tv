import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, id')
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
  const { reportId, action } = body
  if (!reportId || !action) return NextResponse.json({ error: 'reportId and action required' }, { status: 400 })

  const service = createServiceClient()

  const status = action === 'action' ? 'actioned' : action === 'dismiss' ? 'dismissed' : 'reviewed'

  const { error } = await service
    .from('content_reports')
    .update({
      status,
      reviewed_by: admin.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', reportId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
