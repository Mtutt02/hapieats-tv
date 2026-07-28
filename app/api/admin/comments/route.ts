import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = createClient()
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

/** GET /api/admin/comments  — list all comments for moderation */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)
    const offset = parseInt(searchParams.get('offset') ?? '0')
    const search = searchParams.get('search') ?? ''
    const videoId = searchParams.get('videoId') ?? ''

    const service = createServiceClient()
    let query = service
      .from('comments')
      .select(`
        id, body, created_at, updated_at,
        author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url),
        video:videos!comments_video_id_fkey(id, title, is_flagged)
      `, { count: 'exact' })

    if (search) {
      query = query.ilike('body', `%${search}%`)
    }

    if (videoId) {
      query = query.eq('video_id', videoId)
    }

    const { data: comments, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[admin/comments GET]', error)
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
    }

    return NextResponse.json({ comments, count })
  } catch (err) {
    console.error('[admin/comments]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE /api/admin/comments  — superadmin/moderator deletes a comment */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: me } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!me || !['admin', 'superadmin', 'moderator'].includes(me.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { commentId } = await req.json()
    if (!commentId) return NextResponse.json({ error: 'commentId required' }, { status: 400 })

    const service = createServiceClient()
    const { error } = await service.from('comments').delete().eq('id', commentId)
    if (error) {
      console.error('[admin/comments DELETE]', error)
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/comments]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
