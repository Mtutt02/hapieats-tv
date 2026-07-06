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
  const { videoId, action, reason } = body
  if (!videoId || !action) return NextResponse.json({ error: 'videoId and action required' }, { status: 400 })

  const service = createServiceClient()

  // Moderators cannot delete videos — only admins/superadmins
  if (action === 'delete' && !['admin', 'superadmin'].includes(admin.profile.role ?? '')) {
    return NextResponse.json({ error: 'Only admins can delete videos' }, { status: 403 })
  }

  switch (action) {
    case 'flag': {
      const { error } = await service.from('videos').update({
        is_flagged: true,
        flagged_reason: reason ?? 'Flagged by admin',
      }).eq('id', videoId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    case 'unflag': {
      const { error } = await service.from('videos').update({
        is_flagged: false,
        flagged_reason: null,
      }).eq('id', videoId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    case 'hide': {
      const { error } = await service.from('videos').update({ visibility: 'private' }).eq('id', videoId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    case 'unhide': {
      const { error } = await service.from('videos').update({ visibility: 'public' }).eq('id', videoId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    case 'delete': {
      const { error } = await service.from('videos').delete().eq('id', videoId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
