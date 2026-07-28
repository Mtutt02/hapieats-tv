import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: { videoId: string }
}

// GET /api/videos/[videoId]/comments — public
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = createClient()

  const { data: comments, error } = await supabase
    .from('comments')
    .select('*, author:profiles(id, username, display_name, avatar_url)')
    .eq('video_id', params.videoId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ comments })
}

// POST /api/videos/[videoId]/comments — auth-gated
export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const commentBody: string = body?.body ?? ''

  if (commentBody.length < 1 || commentBody.length > 2000) {
    return NextResponse.json(
      { error: 'Comment must be between 1 and 2000 characters' },
      { status: 400 }
    )
  }

  const { data: comment, error } = await supabase
    .from('comments')
    .insert({ video_id: params.videoId, author_id: user.id, body: commentBody })
    .select('*, author:profiles(id, username, display_name, avatar_url)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ comment }, { status: 201 })
}

// DELETE /api/videos/[videoId]/comments — auth-gated, body: { commentId }
export async function DELETE(req: NextRequest, { params: _params }: RouteContext) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const commentId: string = body?.commentId ?? ''

  if (!commentId) {
    return NextResponse.json({ error: 'commentId is required' }, { status: 400 })
  }

  // Verify ownership before deleting (RLS also enforces this, but be explicit)
  const { data: existing } = await supabase
    .from('comments')
    .select('id, author_id')
    .eq('id', commentId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  if (existing.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('comments').delete().eq('id', commentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
