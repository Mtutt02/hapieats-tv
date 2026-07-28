import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface RouteContext {
  params: { videoId: string }
}

async function getTriedCount(videoId: string): Promise<number> {
  const supabase = createServiceClient()
  const { count } = await supabase
    .from('tried_this')
    .select('id', { count: 'exact', head: true })
    .eq('video_id', videoId)
  return count ?? 0
}

// POST /api/videos/[videoId]/tried — toggle "tried this" for the current user
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if already tried
  const { data: existing } = await supabase
    .from('tried_this')
    .select('id')
    .eq('video_id', params.videoId)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    // Un-mark it
    await supabase
      .from('tried_this')
      .delete()
      .eq('video_id', params.videoId)
      .eq('user_id', user.id)

    const triedCount = await getTriedCount(params.videoId)
    return NextResponse.json({ tried: false, triedCount })
  }

  // Mark it
  const { error } = await supabase
    .from('tried_this')
    .insert({ video_id: params.videoId, user_id: user.id })

  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const triedCount = await getTriedCount(params.videoId)
  return NextResponse.json({ tried: true, triedCount })
}
