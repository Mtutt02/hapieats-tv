import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: { videoId: string }
}

async function getLikeCount(supabase: ReturnType<typeof createClient>, videoId: string): Promise<number> {
  const { data } = await supabase
    .from('videos')
    .select('like_count')
    .eq('id', videoId)
    .single()
  return data?.like_count ?? 0
}

// POST /api/videos/[videoId]/like — auth-gated, upserts a like
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('video_likes')
    .insert({ video_id: params.videoId, user_id: user.id })

  // Ignore unique-violation (already liked) — error code 23505
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const likeCount = await getLikeCount(supabase, params.videoId)

  return NextResponse.json({ liked: true, likeCount })
}

// DELETE /api/videos/[videoId]/like — auth-gated, removes the like
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('video_likes')
    .delete()
    .eq('video_id', params.videoId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const likeCount = await getLikeCount(supabase, params.videoId)

  return NextResponse.json({ liked: false, likeCount })
}
