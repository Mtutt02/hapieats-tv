import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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
